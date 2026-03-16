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

      __wt_main_root = ''
        set -l worktrees (command git worktree list --porcelain 2>/dev/null | string match -r '^worktree .+')
        if test (count $worktrees) -eq 0
          return 1
        end

        string replace -r '^worktree ' "" -- $worktrees[1]
      '';

      __wt_repo_dir = ''
        set -l main_root (__wt_main_root)
        if test -z "$main_root"
          return 1
        end

        printf "%s/%s\n" "$HOME/.wt-worktrees" (basename "$main_root")
      '';

      __wt_normalize_path = ''
        if test -z "$argv[1]"
          return 1
        end

        if test -d "$argv[1]"
          command sh -c 'cd "$1" && pwd -P' sh "$argv[1]"
        else
          printf "%s\n" "$argv[1]"
        end
      '';

      __wt_random_name = ''
        set -l left \
          amber ash brisk cedar cinder comet copper ember flint frost harbor ivory juniper maple mist north orbit raven river scout silver solar stone swift timber topo
        set -l right \
          ant bird bloom brook cloud cove dune field finch flame fox grove hawk leaf meadow moth owl pine reef ridge sparrow star surf trout wave wolf wren

        printf "%s-%s\n" $left[(random 1 (count $left))] $right[(random 1 (count $right))]
      '';

      __wt_pick_name = ''
        set -l repo_dir (__wt_repo_dir)
        if test -z "$repo_dir"
          return 1
        end

        set -l attempts 0
        while test $attempts -lt 40
          set attempts (math "$attempts + 1")
          set -l candidate (__wt_random_name)

          if test -e "$repo_dir/$candidate"
            continue
          end

          if command git show-ref --verify --quiet "refs/heads/$candidate"
            continue
          end

          printf "%s\n" "$candidate"
          return 0
        end

        while true
          set -l candidate (__wt_random_name)-(random 100 999)

          if test -e "$repo_dir/$candidate"
            continue
          end

          if command git show-ref --verify --quiet "refs/heads/$candidate"
            continue
          end

          printf "%s\n" "$candidate"
          return 0
        end
      '';

      __wt_is_registered = ''
        set -l target (__wt_normalize_path "$argv[1]")
        if test -z "$target"
          set target "$argv[1]"
        end

        set -l worktrees (command git worktree list --porcelain 2>/dev/null | string match -r '^worktree .+')
        contains -- "worktree $target" $worktrees
      '';

      __wt_rename_tmux_window = ''
        if not set -q TMUX
          return 0
        end

        if not command -sq tmux
          return 0
        end

        command tmux rename-window -- $argv[1] >/dev/null 2>/dev/null
      '';

      __wt_open = ''
        set -l name $argv[1]
        if test -z "$name"
          echo "wt: missing name" >&2
          return 1
        end

        set -l repo_dir (__wt_repo_dir)
        if test -z "$repo_dir"
          return 1
        end

        set -l target "$repo_dir/$name"
        command mkdir -p -- "$repo_dir"

        if test -d "$target"
          if __wt_is_registered "$target"
            cd "$target"
            or return 1
            __wt_rename_tmux_window "$name"
            return 0
          end

          echo "wt: $target already exists but is not a git worktree" >&2
          return 1
        end

        if command git show-ref --verify --quiet "refs/heads/$name"
          command git worktree add "$target" "$name" >/dev/null
        else
          command git worktree add -b "$name" "$target" HEAD >/dev/null
        end
        if test $status -ne 0
          return 1
        end

        cd "$target"
        or return 1

        __wt_rename_tmux_window "$name"
      '';

      __wt_remove = ''
        set -l main_root (__wt_main_root)
        if test -z "$main_root"
          return 1
        end

        set -l current_root (command git rev-parse --show-toplevel 2>/dev/null)
        if test -n "$current_root"
          set current_root (__wt_normalize_path "$current_root")
        end

        set -l target
        if test -n "$argv[1]"
          if string match -q -- '/*' "$argv[1]"
            set target "$argv[1]"
          else
            set -l repo_dir (__wt_repo_dir)
            if test -z "$repo_dir"
              return 1
            end
            set target "$repo_dir/$argv[1]"
          end
        else
          if test "$current_root" = "$main_root"
            echo "wt: give a name or run this inside a linked worktree" >&2
            return 1
          end
          set target "$current_root"
        end

        set -l normalized_target (__wt_normalize_path "$target")
        if test -n "$normalized_target"
          set target "$normalized_target"
        end

        if test "$target" = "$main_root"
          echo "wt: refusing to remove the main worktree" >&2
          return 1
        end

        if not __wt_is_registered "$target"
          echo "wt: no worktree at $target" >&2
          return 1
        end

        set -l inside 0
        if test "$current_root" = "$target"
          set inside 1
        end

        if test $inside -eq 1
          cd "$main_root"
          or return 1
        end

        command git -C "$main_root" worktree remove "$target"
        or return 1

        if test $inside -eq 1
          __wt_rename_tmux_window (basename "$main_root")
        end
      '';

      wt = ''
        if not command git rev-parse --is-inside-work-tree >/dev/null 2>/dev/null
          echo "wt: not in a git repo" >&2
          return 1
        end

        set -l subcommand "$argv[1]"

        switch "$subcommand"
          case ""
            set -l name (__wt_pick_name)
            if test -z "$name"
              return 1
            end
            __wt_open "$name"
          case ls list
            command git worktree list
          case rm remove
            __wt_remove $argv[2]
          case -h --help help
            echo "usage: wt [name]"
            echo "       wt ls"
            echo "       wt rm [name]"
          case '*'
            __wt_open "$argv[1]"
        end
      '';
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
