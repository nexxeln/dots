{ config, pkgs, ... }:

{
  programs.gh = {
    enable = true;
    settings = {
      version = "1";
      git_protocol = "https";
      prompt = "enabled";
      prefer_editor_prompt = "disabled";
      pager = "";
      aliases = {
        co = "pr checkout";
      };
      color_labels = "disabled";
      accessible_colors = "disabled";
      accessible_prompter = "disabled";
      spinner = "enabled";
    };
  };
}
