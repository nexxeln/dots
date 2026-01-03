{ config, pkgs, ... }:

{
  programs.bat = {
    enable = true;
    config = {
      theme = "vesper";
      style = "numbers,changes";
      tabs = "2";
    };
  };
}
