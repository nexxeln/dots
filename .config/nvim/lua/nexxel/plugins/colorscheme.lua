return {
	-- {
	-- 	"bluz71/vim-nightfly-guicolors",
	-- 	priority = 1000,
	-- 	config = function()
	-- 		vim.g.nightflyTransparent = true
	-- 		vim.cmd.colorscheme("nightfly")
	-- 	end,
	-- }
	{
		"rebelot/kanagawa.nvim",
		priority = 1000,
		config = function()
			vim.cmd.colorscheme("kanagawa-dragon")
		end,
	}
	-- {
	--   "craftzdog/solarized-osaka.nvim",
	--   lazy = false,
	--   priority = 1000,
	--   opts = {},
	--   config = function ()
	-- 	require("solarized-osaka").setup({
	-- 		transparent = true
	-- 	})
	-- 	vim.cmd[[colorscheme solarized-osaka]]
	--   end
	--
	-- }
}
