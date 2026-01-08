{ pkgs, ... }:

{
  homebrew = {
    enable = true;

    onActivation = {
      # "zap" removes everything not listed here
      # start with "none" until verified, then switch to "zap"
      cleanup = "none"; # change to "zap" after verifying all packages are listed
      autoUpdate = true;
      upgrade = true;
    };

    # where to look for casks
    caskArgs.no_quarantine = true;

    taps = [
      "withgraphite/tap"
    ];

    brews = [
      # core
      "bash"
      "fish"
      "starship"
      "tmux"
      "neovim"

      # git & vcs
      "gh"
      "git-delta"
      "jj"
      "withgraphite/tap/graphite"

      # search & navigation
      "fd"
      "fzf"
      "ripgrep"
      "zoxide"
      "eza"
      "bat"
      "television"
      "yazi"

      # dev tools
      "ast-grep"
      "tokei"
      "scc"
      "typos-cli"
      "stow"
      "glow"

      # languages & runtimes
      "fnm"
      "pipx"
      "uv"
      "ruff"
      "ty"
      "zig"

      # media
      "ffmpeg"
      "imagemagick"
      "poppler"
      "resvg"
      "ttfautohint"

      # data
      "jq"
      "sqlite"
      "redis"
      "postgresql@14"

      # network
      "curl"
      "wget"
      "cloudflared"
      "openssh"

      # security
      "gnupg"
      "pinentry"

      # compression
      "sevenzip"
      "xz"
      "zstd"
      "lz4"
      "lzo"

      # misc cli
      "tree-sitter"

      # build deps (often pulled in by others, but explicit is good)
      "openssl@3"
      "readline"
      "ncurses"
      "gettext"
      "ca-certificates"

      # llvm (for compiling)
      "llvm@20"
      "lld@20"
    ];

    casks = [
      # fonts
      "font-symbols-only-nerd-font"

      # utils
      "1password"
      "keycastr"
      "ngrok"
    ];
  };
}
