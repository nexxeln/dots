{ config, pkgs, ... }:

{
  # fd (better find) - installed via homebrew but configure here
  programs.fd = {
    enable = true;
    ignores = [
      ".git/"
      "node_modules/"
      ".direnv/"
      "target/"
      "__pycache__/"
    ];
  };

  # ripgrep config
  home.file.".ripgreprc".text = ''
    --smart-case
    --hidden
    --glob=!.git/*
    --glob=!node_modules/*
    --glob=!.direnv/*
    --glob=!target/*
  '';

  home.sessionVariables = {
    RIPGREP_CONFIG_PATH = "$HOME/.ripgreprc";
  };

  # yazi file manager
  programs.yazi = {
    enable = true;
    enableFishIntegration = true;
  };
}
