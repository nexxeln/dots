return {
	{
		"nvim-treesitter/nvim-treesitter",
		event = { "BufReadPre", "BufNewFile" },
		build = ":TSUpdate",
		dependencies = {
			"nvim-treesitter/nvim-treesitter-textobjects",
		},
		config = function ()
			local treesitter = require("nvim-treesitter.configs")

			treesitter.setup({
				highlight = {
					enable = true
				},
				indent = {
					enable = true
				},
				autotag = {
					enable = true
				},
				ensure_installed = {
					"c",
					"cpp",
					"astro",
					"json",
					"javascript",
					"typescript",
					"tsx",
					"yaml",
					"html",
					"css",
					"prisma",
					"markdown",
					"markdown_inline",
					"svelte",
					"graphql",
					"bash",
					"lua",
					"vim",
					"dockerfile",
					"gitignore",
					"query",
				},
				incremental_selection = {
					enable = true,
					keymaps = {
						init_selection = "<C-space>",
						node_incremental = "<C-space>",
						scope_incremental = false,
						node_decremental = "<bs>"
					}
				},
				context_commentstring = {
					enable = true,
					enable_autocmd = false
				}
			})
		end
	}
}
