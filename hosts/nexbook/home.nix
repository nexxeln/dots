{ config, pkgs, lib, username, ... }:

{
  imports = [
    ../../modules/home/shell/fish.nix
    ../../modules/home/shell/starship.nix
    ../../modules/home/git.nix
    ../../modules/home/terminal/tmux.nix
    ../../modules/home/terminal/ghostty.nix
    ../../modules/home/editors/neovim.nix
    ../../modules/home/tools/bat.nix
    ../../modules/home/tools/dev.nix
    ../../modules/home/tools/gh.nix
    ../../modules/home/packages/node.nix
  ];

  home = {
    username = username;
    homeDirectory = "/Users/${username}";
    stateVersion = "24.11";

    # extra dotfiles to link
    file = {
      # opencode config
      ".config/opencode" = {
        source = ../../config/opencode;
        recursive = true;
      };


    };

    # session variables
    sessionVariables = {
      EDITOR = "nvim";
      VISUAL = "nvim";
      PAGER = "bat";
    };
  };

  # let home-manager manage itself
  programs.home-manager.enable = true;
}
