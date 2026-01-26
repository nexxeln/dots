{ config, pkgs, lib, ... }:

{
  programs.fish = {
    enable = true;

    interactiveShellInit = ''
      # vi key bindings
      fish_vi_key_bindings

      # homebrew
      eval "$(/opt/homebrew/bin/brew shellenv)"

      # fnm (node version manager)
      fnm env --use-on-cd --shell fish | source

      # bun
      set --export BUN_INSTALL "$HOME/.bun"
      set --export PATH $BUN_INSTALL/bin $PATH

      # foundry (ethereum)
      fish_add_path -a $HOME/.foundry/bin

      # pnpm
      set -gx PNPM_HOME "$HOME/Library/pnpm"
      if not string match -q -- $PNPM_HOME $PATH
        set -gx PATH "$PNPM_HOME" $PATH
      end

      # opencode
      fish_add_path $HOME/.opencode/bin

      # ami
      set --export AMI_INSTALL "$HOME/.ami"
      set --export PATH $AMI_INSTALL/bin $PATH

      # qlty
      set --export QLTY_INSTALL "$HOME/.qlty"
      set --export PATH $QLTY_INSTALL/bin $PATH

      # orbstack integration
      source ~/.orbstack/shell/init2.fish 2>/dev/null || true

      # cargo
      fish_add_path $HOME/.cargo/bin
    '';

    shellAliases = {
      # git
      g = "git";

      # editor
      e = "nvim";
      fishrc = "nvim ~/.config/fish/config.fish";
      reload = "source ~/.config/fish/config.fish";

      # cursor
      c = "open $argv -a 'Cursor'";

      # package managers
      pn = "pnpm";

      # file listing (eza)
      ll = "eza -l -g --git";
      llt = "eza -1 --git --tree --git-ignore";
      la = "eza -la -g --git";

      # python
      py = "python3";

      # keep display awake
      ds = "caffeinate -d";

      # opencode
      oc = "opencode -c";

      # claude code
      clc = "claude --dangerously-skip-permissions";

      # rebuild nix
      rebuild = "sudo darwin-rebuild switch --flake ~/.dots";
    };

    functions = {
      # fish greeting
      fish_greeting = "";
    };
  };

  # zoxide (better cd)
  programs.zoxide = {
    enable = true;
    enableFishIntegration = true;
  };

  # fzf
  programs.fzf = {
    enable = true;
    enableFishIntegration = true;
    defaultOptions = [
      "--height=40%"
      "--layout=reverse"
      "--border"
      "--color=bg:#101010,bg+:#232323,fg:#A0A0A0,fg+:#FFFFFF,hl:#FFC799,hl+:#FFC799,pointer:#FFC799,prompt:#FFC799,info:#5C5C5C"
    ];
  };

  # eza (better ls)
  programs.eza = {
    enable = true;
    enableFishIntegration = true;
    git = true;
    icons = "auto";
  };

  # direnv
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };
}
