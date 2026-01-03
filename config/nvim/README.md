# nvim config

minimal neovim configuration with sensible defaults and essential plugins.

**leader key:** `<Space>`

## keybinds

### general

| key | mode | action |
|-----|------|--------|
| `<Esc>` | n | clear search highlights |
| `<leader>q` | n | open diagnostic quickfix list |
| `<Esc><Esc>` | t | exit terminal mode |

### window navigation

| key | mode | action |
|-----|------|--------|
| `<C-h>` | n | move focus left |
| `<C-l>` | n | move focus right |
| `<C-j>` | n | move focus down |
| `<C-k>` | n | move focus up |

### telescope (search)

| key | mode | action |
|-----|------|--------|
| `<leader>sf` | n | search files |
| `<leader>sg` | n | search grep |
| `<leader>sw` | n | search word under cursor |
| `<leader>sh` | n | search help |
| `<leader>sk` | n | search keymaps |
| `<leader>sd` | n | search diagnostics |
| `<leader>sr` | n | search resume |
| `<leader>s.` | n | search recent files |
| `<leader><leader>` | n | find buffers |
| `<leader>/` | n | fuzzy search current buffer |

### lsp

| key | mode | action |
|-----|------|--------|
| `gd` | n | goto definition |
| `gr` | n | goto references |
| `gI` | n | goto implementation |
| `gy` | n | goto type definition |
| `gD` | n | goto declaration |
| `K` | n | hover documentation |
| `<leader>cs` | n | document symbols |
| `<leader>cS` | n | workspace symbols |
| `<leader>cr` | n | rename symbol |
| `<leader>ca` | n, x | code action |

### git (gitsigns)

| key | mode | action |
|-----|------|--------|
| `]c` | n | next git hunk |
| `[c` | n | prev git hunk |
| `<leader>hs` | n, v | stage hunk |
| `<leader>hr` | n, v | reset hunk |
| `<leader>hS` | n | stage buffer |
| `<leader>hu` | n | undo stage hunk |
| `<leader>hR` | n | reset buffer |
| `<leader>hp` | n | preview hunk |
| `<leader>hb` | n | blame line |
| `<leader>hd` | n | diff this |
| `<leader>hD` | n | diff this ~ |

### oil (file navigation)

| key | mode | action |
|-----|------|--------|
| `-` | n | open parent directory |
| `g?` | n | show help (in oil) |
| `<CR>` | n | select file/directory |
| `<C-v>` | n | select vsplit |
| `<C-s>` | n | select split |
| `<C-t>` | n | select tab |
| `<C-p>` | n | preview |
| `<C-c>` | n | close oil |
| `<C-r>` | n | refresh |
| `_` | n | open cwd |
| `` ` `` | n | cd to directory |
| `~` | n | tcd to directory |
| `gs` | n | change sort |
| `gx` | n | open external |
| `g.` | n | toggle hidden files |

### toggle

| key | mode | action |
|-----|------|--------|
| `<leader>tb` | n | toggle git blame |
| `<leader>td` | n | toggle deleted lines |
| `<leader>th` | n | toggle inlay hints |

### surround (mini.surround)

| key | mode | action |
|-----|------|--------|
| `sa` | n, v | add surrounding |
| `sd` | n | delete surrounding |
| `sr` | n | replace surrounding |
| `sf` | n | find surrounding (right) |
| `sF` | n | find surrounding (left) |
| `sh` | n | highlight surrounding |
| `sn` | n | update n lines |

### text objects (mini.ai)

enhanced text objects with support for:
- `a` and `i` prefix for "around" and "inside"
- brackets: `()`, `[]`, `{}`, `<>`
- quotes: `'`, `"`, `` ` ``
- function arguments, calls, and tags

### completion (blink.cmp)

| key | mode | action |
|-----|------|--------|
| `<C-space>` | i | show completion |
| `<C-e>` | i | hide completion |
| `<C-y>` | i | accept completion |
| `<C-n>` | i | select next |
| `<C-p>` | i | select prev |
| `<C-b>` | i | scroll docs up |
| `<C-f>` | i | scroll docs down |
| `<Tab>` | i | snippet forward / select next |
| `<S-Tab>` | i | snippet backward / select prev |
