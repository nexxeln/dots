{ config, pkgs, lib, ... }:

let
  # Direct symlinks to dotfiles for live editing
  piConfig = path: config.lib.file.mkOutOfStoreSymlink 
    "/Users/nxl/.dots/config/pi/${path}";
in
{
  home.file = {
    # Pi agent settings (generated, not symlinked)
    ".pi/agent/settings.json".text = builtins.toJSON {
      theme = "vesper";
    };

    # Custom theme
    ".pi/agent/themes/vesper.json".source = piConfig "agent/themes/vesper.json";

    # Agent extensions
    ".pi/agent/extensions/raw-paste.ts".source = piConfig "agent/extensions/raw-paste.ts";
    ".pi/agent/extensions/compaction.ts".source = piConfig "agent/extensions/compaction.ts";
    ".pi/agent/extensions/handoff/index.ts".source = piConfig "agent/extensions/handoff/index.ts";
    ".pi/agent/extensions/review/index.ts".source = piConfig "agent/extensions/review/index.ts";

    # User extensions
    ".pi/extensions/snake/index.ts".source = piConfig "extensions/snake/index.ts";
  };
}
