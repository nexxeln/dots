{ config, pkgs, lib, ... }:

{
  programs.git = {
    enable = true;

    settings = {
      user = {
        name = "Shoubhit Dash";
        email = "shoubhit2005@gmail.com";
      };

      init.defaultBranch = "main";

      core = {
        editor = "nvim";
      };

      merge = {
        conflictStyle = "zdiff3";
      };

      push = {
        autoSetupRemote = true;
        default = "current";
      };

      pull = {
        rebase = true;
      };

      rebase = {
        autoStash = true;
      };

      diff = {
        algorithm = "histogram";
        colorMoved = "default";
      };

      alias = {
        d = "diff";
        co = "checkout";
        cm = "commit";
        st = "status";
        a = "add";
        hist = "log --pretty=format:\"%Cgreen%h %Creset%cd %Cblue[%cn] %Creset%s%C(yellow)%d%C(reset)\" --graph --date=relative --decorate --all";
        llog = "log --graph --name-status --pretty=format:\"%C(red)%h %C(reset)(%cd) %C(green)%an %Creset%s %C(yellow)%d%Creset\" --date=relative";
        ps = "!git push origin $(git rev-parse --abbrev-ref HEAD)";
        pl = "!git pull origin $(git rev-parse --abbrev-ref HEAD)";
        open = "!gh browse";
        nuke = "!git restore . && git clean -fd";
      };
    };

    ignores = [
      ".DS_Store"
      "._*"
      ".idea/"
      ".vscode/"
      "*.swp"
      "*.swo"
      "*~"
      "**/.claude/settings.local.json"
      ".env"
      ".env.local"
      ".env*.local"
      "node_modules/"
      "__pycache__/"
      "*.pyc"
      ".venv/"
      "venv/"
    ];
  };

  # delta (git pager) - separate program now
  programs.delta = {
    enable = true;
    enableGitIntegration = true;
    options = {
      navigate = true;
      side-by-side = false;
    };
  };
}
