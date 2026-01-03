# Effect-TS Patterns

Condensed patterns from effect-solutions. Run `effect-solutions show <topic>` for full docs.

---

## Basics

### Effect.gen

Use `Effect.gen` with `yield*` for sequential, readable code (like async/await for Effect):

```typescript
const program = Effect.gen(function* () {
  const data = yield* fetchData
  yield* Effect.logInfo(`Processing: ${data}`)
  return yield* processData(data)
})
```

### Effect.fn

Use `Effect.fn` for traced, named functions with call-site tracking:

```typescript
const processUser = Effect.fn("processUser")(function* (userId: string) {
  yield* Effect.logInfo(`Processing user ${userId}`)
  const user = yield* getUser(userId)
  return yield* processData(user)
})
```

### Pipe for Instrumentation

Use `.pipe()` for cross-cutting concerns: timeouts, retries, logging, spans:

```typescript
const program = fetchData.pipe(
  Effect.timeout("5 seconds"),
  Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(3)))),
  Effect.tap((data) => Effect.logInfo(`Fetched: ${data}`)),
  Effect.withSpan("fetchData")
)
```

---

## Services & Layers

### Context.Tag

Define services as classes with unique identifiers:

```typescript
class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}
```

### Layer

Implement services with `Layer.effect`. Use `Effect.fn` for methods:

```typescript
class Users extends Context.Tag("@app/Users")<
  Users,
  { readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound> }
>() {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient

      const findById = Effect.fn("Users.findById")(function* (id: UserId) {
        const response = yield* http.get(`/users/${id}`)
        return yield* HttpClientResponse.schemaBodyJson(User)(response)
      })

      return Users.of({ findById })
    })
  )

  // Test layer with hardcoded values
  static readonly testLayer = Layer.sync(Users, () => {
    const store = new Map<UserId, User>()
    return Users.of({
      findById: (id) =>
        Effect.fromNullable(store.get(id)).pipe(
          Effect.orElseFail(() => UserNotFound.make({ id }))
        )
    })
  })
}
```

### Layer Composition

Provide once at the top of your app:

```typescript
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(configLayer)
)

const main = program.pipe(Effect.provide(appLayer))
```

### Layer Memoization

Store parameterized layers in constants to avoid duplicate construction:

```typescript
// ✅ Good: single connection pool
const postgresLayer = Postgres.layer({ url: "...", poolSize: 10 })

const appLayer = Layer.merge(
  UserRepo.layer.pipe(Layer.provide(postgresLayer)),
  OrderRepo.layer.pipe(Layer.provide(postgresLayer))
)

// ❌ Bad: creates two pools
Layer.merge(
  UserRepo.layer.pipe(Layer.provide(Postgres.layer({ url: "..." }))),
  OrderRepo.layer.pipe(Layer.provide(Postgres.layer({ url: "..." })))
)
```

---

## Data Modeling

### Schema.Class (Records / AND types)

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.Date,
}) {
  get displayName() {
    return `${this.name} (${this.email})`
  }
}
```

### Schema.TaggedClass + Union (Variants / OR types)

```typescript
class Success extends Schema.TaggedClass<Success>()("Success", {
  value: Schema.Number,
}) {}

class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}

const Result = Schema.Union(Success, Failure)
type Result = typeof Result.Type

// Pattern match
Match.valueTags(result, {
  Success: ({ value }) => `Got: ${value}`,
  Failure: ({ error }) => `Error: ${error}`
})
```

### Branded Types

Brand primitives to prevent mixing values with the same underlying type:

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
const PostId = Schema.String.pipe(Schema.brand("PostId"))
const Email = Schema.String.pipe(Schema.brand("Email"))
const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))

// Type errors:
// getUser(postId) - can't pass PostId where UserId expected
// const bad: UserId = "raw-string" - can't assign raw string
```

### JSON Encoding/Decoding

Use `Schema.parseJson` to combine JSON.parse + schema validation:

```typescript
const MoveFromJson = Schema.parseJson(Move)

// Decode JSON string to validated object
const move = yield* Schema.decodeUnknown(MoveFromJson)(jsonString)

// Encode object to JSON string
const json = yield* Schema.encode(MoveFromJson)(move)
```

---

## Error Handling

### Schema.TaggedError

Define serializable, type-safe errors:

```typescript
class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String,
  }
) {}
```

**TaggedErrors are yieldable** - no need for `Effect.fail()`:

```typescript
// ✅ Good
return error.response.status === 404
  ? UserNotFoundError.make({ id })
  : Effect.die(error)

// ❌ Redundant
return Effect.fail(UserNotFoundError.make({ id }))
```

### Recovering from Errors

```typescript
// catchAll - handle all errors
program.pipe(
  Effect.catchAll((error) => Effect.succeed(`Recovered from ${error._tag}`))
)

// catchTag - handle specific error
program.pipe(
  Effect.catchTag("HttpError", (error) =>
    Effect.succeed(`HTTP ${error.statusCode}`)
  )
)

// catchTags - handle multiple errors
program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("HTTP error"),
    ValidationError: () => Effect.succeed("Validation error")
  })
)
```

### Expected Errors vs Defects

**Typed errors (E channel)**: domain failures the caller can handle - validation, not found, permission denied.

**Defects**: unrecoverable bugs and invariant violations. Use `Effect.die` or `Effect.orDie`:

```typescript
// Convert errors to defects when failure means a bug
const config = yield* loadConfig.pipe(Effect.orDie)
```

### Schema.Defect for Unknown Errors

Wrap errors from external libraries:

```typescript
class ApiError extends Schema.TaggedError<ApiError>()(
  "ApiError",
  {
    endpoint: Schema.String,
    statusCode: Schema.Number,
    error: Schema.Defect, // wraps unknown errors
  }
) {}

const fetchUser = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`).then(r => r.json()),
    catch: (error) => ApiError.make({ endpoint: `/api/users/${id}`, statusCode: 500, error })
  })
```

---

## Config

### Config Layer Pattern

Create a config service with production and test layers:

```typescript
class ApiConfig extends Context.Tag("@app/ApiConfig")<
  ApiConfig,
  {
    readonly apiKey: Redacted.Redacted
    readonly baseUrl: string
    readonly timeout: number
  }
>() {
  static readonly layer = Layer.effect(
    ApiConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("API_KEY")
      const baseUrl = yield* Config.string("API_BASE_URL").pipe(
        Config.orElse(() => Config.succeed("https://api.example.com"))
      )
      const timeout = yield* Config.integer("API_TIMEOUT").pipe(
        Config.orElse(() => Config.succeed(30000))
      )
      return ApiConfig.of({ apiKey, baseUrl, timeout })
    })
  )

  static readonly testLayer = Layer.succeed(ApiConfig, {
    apiKey: Redacted.make("test-key"),
    baseUrl: "https://test.example.com",
    timeout: 5000,
  })
}
```

### Config with Schema Validation

```typescript
const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))
const Environment = Schema.Literal("development", "staging", "production")

const port = yield* Schema.Config("PORT", Port)
const env = yield* Schema.Config("ENV", Environment)
```

### Config Primitives

```typescript
Config.string("MY_VAR")
Config.integer("PORT")
Config.boolean("DEBUG")
Config.redacted("API_KEY")  // hidden in logs
Config.url("API_URL")
Config.duration("TIMEOUT")
Config.array(Config.string(), "TAGS")  // comma-separated
```

### Redacted for Secrets

```typescript
const apiKey = yield* Config.redacted("API_KEY")

// Extract value
const headers = { Authorization: `Bearer ${Redacted.value(apiKey)}` }

// Hidden in logs
console.log(apiKey) // <redacted>
```
