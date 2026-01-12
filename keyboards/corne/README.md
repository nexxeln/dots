# Corne v4 ZMK Configuration

ZMK firmware config for Corne v4 with nice!nano v2 and nice!view displays. Optimized for macOS and Vim workflows.

## Features

- **CAGS Home Row Mods** - Ctrl/Alt/Gui/Shift with Cmd on middle finger (Mac-optimized)
- **Urob's Timeless Timing** - 280/175/150ms settings that eliminate misfires
- **Hyper Key** - Hold right inner thumb for Ctrl+Alt+Cmd+Shift (like Raycast)
- **Sticky Shift** - Tap right middle thumb for one-shot shift, hold for Raise layer
- **Conditional Adjust Layer** - Hold Lower + Raise for F-keys, BT, media
- **HJKL Navigation** - Arrow keys on home row in Raise layer
- **macOS Bluetooth Fixes** - TX power and interval settings for Sequoia

## Layers

### Base (QWERTY + Home Row Mods)
```
+-----+----+----+----+----+----+      +----+----+----+----+----+-----+
| TAB |  Q |  W |  E |  R |  T |      |  Y |  U |  I |  O |  P | BSP |
+-----+----+----+----+----+----+      +----+----+----+----+----+-----+
| ESC |CT/A|OP/S|CM/D|SH/F|  G |      |  H |SH/J|CM/K|OP/L|CT/;|  '  |
+-----+----+----+----+----+----+      +----+----+----+----+----+-----+
| SFT |  Z |  X |  C |  V |  B |      |  N |  M |  , |  . |  / | RET |
+-----+----+----+----+----+----+      +----+----+----+----+----+-----+
                 +----+----+----+    +----+----+----+
                 | GUI| LWR| SPC|    | ESC| SFT| BSP|
                 |    |    |    |    |/HYP|/RSE|    |
                 +----+----+----+    +----+----+----+
```

### Lower (Numbers & Symbols)
```
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |  ! |  @ |  # |  $ |  % |      |  ^ |  & |  * |  ( |  ) |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |  1 |  2 |  3 |  4 |  5 |      |  6 |  7 |  8 |  9 |  0 |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |  ` |  [ |  ] |  \ |  ~ |      |  - |  = |  { |  } |  | |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
```

### Raise (Navigation)
```
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |    |    |    |    |    |      |PgUp|Home| Up | End|    | Del|
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |Ctrl| Opt| Cmd| Sft|    |      |PgDn|Left|Down|Rght|    |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |    |    |    |    |    |      |    | W<-|    | W->|    |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
```
Left hand has mods for shortcuts like Cmd+Arrow or Shift+Arrow.

### Adjust (Lower + Raise)
```
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|BTCL| F1 | F2 | F3 | F4 | F5 |      | F6 | F7 | F8 | F9 | F10|    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    | BT0| BT1| BT2| BT3| BT4|      |Vol+|Prev|Play|Next| F11| F12|
+----+----+----+----+----+----+      +----+----+----+----+----+----+
|    |    |    |    |    |    |      |Vol-|Mute|    |    |    |    |
+----+----+----+----+----+----+      +----+----+----+----+----+----+
```

## Build Workflow

### Option 1: GitHub Actions

Workflow is set up at `.github/workflows/build-zmk.yml`:

```yaml
name: Build ZMK Firmware

on:
  workflow_dispatch:
  push:
    paths:
      - "keyboards/corne/**"

jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: zmkfirmware/zmk-build-arm:stable
    strategy:
      matrix:
        include:
          - shield: corne_left nice_view_adapter nice_view
            artifact: corne_left
          - shield: corne_right nice_view_adapter nice_view
            artifact: corne_right
    steps:
      - uses: actions/checkout@v4
      - run: west init -l keyboards/corne/config
      - run: west update
      - run: west zephyr-export
      - run: |
          west build -s zmk/app -p -b nice_nano_v2 -- \
            -DSHIELD="${{ matrix.shield }}" \
            -DZMK_CONFIG="${GITHUB_WORKSPACE}/keyboards/corne/config"
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: build/zephyr/zmk.uf2
```

Push changes to trigger build, then download artifacts from the Actions tab.

### Option 2: Use ZMK's Template

1. Fork [zmk-config](https://github.com/zmkfirmware/zmk-config)
2. Copy `config/` contents to the fork
3. Update `build.yaml` in fork root
4. GitHub Actions builds automatically on push

### Option 3: Local Build

```bash
# Install west and dependencies
pip install west

# Initialize workspace
west init -l keyboards/corne/config
west update

# Build left half
west build -s zmk/app -b nice_nano_v2 -- \
  -DSHIELD="corne_left nice_view_adapter nice_view" \
  -DZMK_CONFIG="$(pwd)/keyboards/corne/config"

# Copy firmware
cp build/zephyr/zmk.uf2 corne_left.uf2

# Build right half
rm -rf build
west build -s zmk/app -b nice_nano_v2 -- \
  -DSHIELD="corne_right nice_view_adapter nice_view" \
  -DZMK_CONFIG="$(pwd)/keyboards/corne/config"

cp build/zephyr/zmk.uf2 corne_right.uf2
```

## Flashing

1. Connect keyboard half via USB
2. Double-tap reset button (enters bootloader, appears as USB drive)
3. Copy `.uf2` file to the drive
4. Drive auto-ejects when complete
5. Repeat for other half

## Bluetooth Pairing

- **BT0-BT4**: Select profile (Adjust layer, left home row)
- **BT_CLR**: Clear current profile's pairing (Adjust layer, top left)

To pair: select an empty profile, put device in pairing mode, keyboard should appear as "Corne".

## Customization

### Adjust Home Row Mod Timing

For faster typists, modify `require-prior-idle-ms` using: `10500 ÷ your_WPM`

```c
// In corne.keymap, find hml/hmr behaviors
require-prior-idle-ms = <105>;  // For 100 WPM
```

### Disable Home Row Mods (Learning Period)

Replace home row in base layer with plain keys:

```c
&kp ESC &kp A &kp S &kp D &kp F &kp G   &kp H &kp J &kp K &kp L &kp SEMI &kp SQT
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Laggy Bluetooth on macOS | Already configured in `corne.conf`, ensure using latest macOS |
| Misfires during fast typing | Increase `require-prior-idle-ms` |
| Accidental layer activations | Increase `tapping-term-ms` |
| Display not working | Check `CONFIG_ZMK_DISPLAY=y` in conf |
| Won't connect after BT_CLR | Remove device from macOS Bluetooth preferences, re-pair |

## Resources

- [ZMK Documentation](https://zmk.dev/docs)
- [Urob's Timeless HRM](https://github.com/urob/zmk-config)
- [ZMK Keymap Editor](https://nickcoutsos.github.io/keymap-editor/) (visual editor)
