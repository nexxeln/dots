{ config, pkgs, lib, ... }:

{
  # ghostty doesn't have a home-manager module yet, so we symlink
  home.file.".config/ghostty/config".source = ../../../config/ghostty/config;
}
