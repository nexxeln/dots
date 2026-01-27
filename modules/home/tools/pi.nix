{ config, pkgs, lib, username, ... }:

let
  piDots = path: config.lib.file.mkOutOfStoreSymlink 
    "/Users/${username}/.dots/config/pi/${path}";
in
{
  home.file = {
    # Symlink directories - any new files inside are automatically tracked
    ".pi/agent/extensions".source = piDots "agent/extensions";
    ".pi/agent/themes".source = piDots "agent/themes";
    ".pi/agent/settings.json".source = piDots "agent/settings.json";
    
    # User-level extensions (if you have any)
    # ".pi/extensions".source = piDots "extensions";
  };
}
