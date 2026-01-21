{ config, pkgs, lib, ... }:

let
  # vesper colors
  colors = {
    bg = "#101010";
    bg_elevated = "#1A1A1A";
    bg_selected = "#232323";
    fg = "#FFFFFF";
    fg_muted = "#A0A0A0";
    fg_dim = "#5C5C5C";
    accent = "#FFC799";
    mint = "#99FFE4";
    border = "#282828";
  };
in
{
  programs.tmux = {
    enable = true;
    shell = "${pkgs.fish}/bin/fish";
    terminal = "tmux-256color";
    prefix = "C-a";
    baseIndex = 1;
    escapeTime = 0;
    mouse = true;
    keyMode = "vi";
    historyLimit = 50000;

    plugins = with pkgs.tmuxPlugins; [
      {
        plugin = resurrect;
        extraConfig = ''
          set -g @resurrect-capture-pane-contents 'on'
          set -g @resurrect-strategy-nvim 'session'
        '';
      }
      {
        plugin = continuum;
        extraConfig = ''
          set -g @continuum-restore 'on'
          set -g @continuum-save-interval '15'
        '';
      }
    ];

    extraConfig = ''
      # true color
      set -ag terminal-overrides ",*:RGB"

      # renumber windows
      set -g renumber-windows on

      # splits in cwd
      bind \\ split-window -h -c "#{pane_current_path}"
      bind Enter split-window -v -c "#{pane_current_path}"

      # new window in cwd
      bind c new-window -c "#{pane_current_path}"

      # pane nav without prefix (alt+hjkl)
      bind -n M-h select-pane -L
      bind -n M-j select-pane -D
      bind -n M-k select-pane -U
      bind -n M-l select-pane -R

      # pane nav with prefix (fallback)
      bind h select-pane -L
      bind j select-pane -D
      bind k select-pane -U
      bind l select-pane -R

      # resize without prefix (alt+shift+hjkl)
      bind -n M-H resize-pane -L 5
      bind -n M-J resize-pane -D 5
      bind -n M-K resize-pane -U 5
      bind -n M-L resize-pane -R 5

      # window nav without prefix
      bind -n M-1 select-window -t 1
      bind -n M-2 select-window -t 2
      bind -n M-3 select-window -t 3
      bind -n M-4 select-window -t 4
      bind -n M-5 select-window -t 5
      bind -n M-6 select-window -t 6
      bind -n M-7 select-window -t 7
      bind -n M-8 select-window -t 8
      bind -n M-9 select-window -t 9
      bind -n M-n next-window
      bind -n M-p previous-window

      # quick actions
      bind x kill-pane
      bind X kill-window
      bind z resize-pane -Z

      # session switcher (fuzzy)
      bind s display-popup -E -w 40% -h 40% -S "fg=#282828" -b rounded \
          "tmux list-sessions -F '#S' | fzf --reverse --border=none --margin=1 --padding=1 \
          --prompt='  ' --pointer='▌' --no-scrollbar \
          --color=bg:#101010,bg+:#232323,fg:#A0A0A0,fg+:#FFFFFF,hl:#FFC799,hl+:#FFC799,pointer:#FFC799,prompt:#FFC799,info:#5C5C5C \
          | xargs -I{} tmux switch-client -t {}"

      # sessionizer (fuzzy find projects, create/switch session)
      bind f display-popup -E -w 50% -h 50% -S "fg=#282828" -b rounded "~/.config/tmux/scripts/sessionizer"

      # last session
      bind L switch-client -l

      # reload
      bind r source-file ~/.config/tmux/tmux.conf \; display "reloaded"

      # copy mode
      bind -T copy-mode-vi v send -X begin-selection
      bind -T copy-mode-vi y send -X copy-selection-and-cancel

      # no bells
      set -g visual-activity off
      set -g visual-bell off
      set -g visual-silence off
      setw -g monitor-activity off
      set -g bell-action none

      # status bar
      set -g status-position top
      set -g status-justify left
      set -g status-style "bg=${colors.bg} fg=${colors.fg_muted}"
      set -g status-interval 1

      # left: session
      set -g status-left "#[fg=${colors.accent},bold] #S #[fg=${colors.fg_dim}]│ "
      set -g status-left-length 20

      # right: time only
      set -g status-right "#[fg=${colors.fg_muted}]%-I:%M %p "
      set -g status-right-length 50

      # window format
      setw -g window-status-format "#[fg=${colors.fg_dim}] #I #W "
      setw -g window-status-current-format "#[fg=${colors.fg},bold] #I #W "
      setw -g window-status-separator ""

      # pane borders
      set -g pane-border-lines simple
      set -g pane-border-style "fg=${colors.border}"
      set -g pane-active-border-style "fg=${colors.accent}"

      # message style
      set -g message-style "bg=${colors.bg_selected} fg=${colors.fg}"
      set -g message-command-style "bg=${colors.bg_selected} fg=${colors.fg}"

      # mode style (copy mode)
      setw -g mode-style "bg=${colors.bg_selected} fg=${colors.fg}"

      # clock
      setw -g clock-mode-colour "${colors.accent}"
    '';
  };

  # sessionizer script
  home.file.".config/tmux/scripts/sessionizer" = {
    executable = true;
    text = ''
      #!/usr/bin/env bash

      SEARCH_DIRS=(
          ~/code
          ~/projects
          ~/work
          ~/.config
      )

      dirs=""
      for dir in "''${SEARCH_DIRS[@]}"; do
          [[ -d "$dir" ]] && dirs="$dirs $dir"
      done

      selected=$(
          {
              tmux list-sessions -F "#{session_name}" 2>/dev/null
              [[ -n "$dirs" ]] && find $dirs -mindepth 1 -maxdepth 2 -type d 2>/dev/null
          } | fzf --reverse --border=none --margin=1 --padding=1 \
              --prompt='  ' --pointer='▌' --no-scrollbar \
              --color=bg:#101010,bg+:#232323,fg:#A0A0A0,fg+:#FFFFFF,hl:#FFC799,hl+:#FFC799,pointer:#FFC799,prompt:#FFC799,info:#5C5C5C
      )

      [[ -z "$selected" ]] && exit 0

      if [[ "$selected" == /* ]]; then
          session_name=$(basename "$selected" | tr '.' '_')
          session_path="$selected"
      else
          session_name="$selected"
          session_path=""
      fi

      if tmux has-session -t="$session_name" 2>/dev/null; then
          tmux switch-client -t "$session_name"
      else
          if [[ -n "$session_path" ]]; then
              tmux new-session -ds "$session_name" -c "$session_path"
          else
              tmux new-session -ds "$session_name"
          fi
          tmux switch-client -t "$session_name"
      fi
    '';
  };
}
