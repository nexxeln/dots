# dots

nix-darwin + home-manager config for macos (apple silicon)

## install

```bash
curl -fsSL https://raw.githubusercontent.com/nexxeln/dots/main/scripts/bootstrap.sh | bash
```

## rebuild

```bash
rebuild
```

## structure

```
hosts/nexbook/     # machine config
modules/darwin/    # macos system settings, homebrew
modules/home/      # shell, terminal, editor, tools
config/            # nvim, ghostty, opencode
```

## stack

- **shell**: fish + starship
- **terminal**: ghostty + tmux
- **editor**: neovim
- **theme**: vesper
