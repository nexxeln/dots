{ config, pkgs, lib, ... }:

{
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
  };

  # symlink nvim config (complex lua config, not worth converting to nix)
  home.file.".config/nvim" = {
    source = ../../../config/nvim;
    recursive = true;
  };
}
