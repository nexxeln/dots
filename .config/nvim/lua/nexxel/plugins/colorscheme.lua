return {
	{
		"bluz71/vim-nightfly-guicolors",
		priority = 1000,
		config = function()
			vim.g.nightflyTransparent = true
			vim.cmd.colorscheme("nightfly")
		end,
	}
}
