fish_vi_key_bindings



if status is-interactive
    # Commands to run in interactive sessions can go here
end

set -gx PNPM_HOME "/Users/nxl/Library/pnpm"
if not contains $PNPM_HOME $PATH
    set -gx PATH $PNPM_HOME $PATH
end


alias g=git
alias fishrc="nvim ~/.config/fish/config.fish"
alias reload="source ~/.config/fish/config.fish"
alias c="open $1 -a \"Visual Studio Code - Insiders\""
alias pn=pnpm
alias ll="exa -l -g --git"
alias llt="exa -1 --git --tree --git-ignore"
alias e="nvim"
alias py="python3"
alias aocd="cd /Users/nxl/Code/aoc/"
alias aoc="aot; aos"
alias aot="aocd; echo -e '\033[94m'; python3 main.py < test.txt; echo -e '\033[0m'"
alias aos="aocd; python3 main.py < in.txt"
alias ds="caffeinate -d"
alias fds="git add -A && git commit -m 'fastcommit' && git push"
alias fetch="macchina"

# opam configuration
source /Users/nxl/.opam/opam-init/init.fish > /dev/null 2> /dev/null; or true

starship init fish | source
zoxide init fish | source

set -q GHCUP_INSTALL_BASE_PREFIX[1]; or set GHCUP_INSTALL_BASE_PREFIX $HOME ; set -gx PATH $HOME/.cabal/bin $PATH /Users/nxl/.ghcup/bin # ghcup-env

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH

fish_add_path /Users/nxl/.spicetify
