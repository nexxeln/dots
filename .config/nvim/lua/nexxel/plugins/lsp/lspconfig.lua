return {
	"neovim/nvim-lspconfig",
	dependencies = {
		"hrsh7th/cmp-nvim-lsp"
	},
	config = function()
		local lspconfig = require("lspconfig")
		local cmp_nvim_lsp = require("cmp_nvim_lsp")

		local keymap = vim.keymap

		local opts = { noremap = true, silent = true }

		local on_attach = function(client, bufnr)
		  opts.buffer = bufnr

		  -- set keybinds
		  opts.desc = "Show LSP references"
		  keymap.set("n", "gR", "<cmd>Telescope lsp_references<CR>", opts) -- show definition, references

		  opts.desc = "Go to declaration"
		  keymap.set("n", "gD", vim.lsp.buf.declaration, opts) -- go to declaration

		  opts.desc = "Show LSP definitions"
		  keymap.set("n", "gd", "<cmd>Telescope lsp_definitions<CR>", opts) -- show lsp definitions

		  opts.desc = "Show LSP implementations"
		  keymap.set("n", "gi", "<cmd>Telescope lsp_implementations<CR>", opts) -- show lsp implementations

		  opts.desc = "Show LSP type definitions"
		  keymap.set("n", "gt", "<cmd>Telescope lsp_type_definitions<CR>", opts) -- show lsp type definitions

		  opts.desc = "See available code actions"
		  keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, opts) -- see available code actions, in visual mode will apply to selection

		  opts.desc = "Smart rename"
		  keymap.set("n", "gr", vim.lsp.buf.rename, opts) -- smart rename

		  opts.desc = "Show buffer diagnostics"
		  keymap.set("n", "<leader>D", "<cmd>Telescope diagnostics bufnr=0<CR>", opts) -- show  diagnostics for file

		  opts.desc = "Show line diagnostics"
		  keymap.set("n", "<leader>d", vim.diagnostic.open_float, opts) -- show diagnostics for line

		  opts.desc = "Go to previous diagnostic"
		  keymap.set("n", "[d", vim.diagnostic.goto_prev, opts) -- jump to previous diagnostic in buffer

		  opts.desc = "Go to next diagnostic"
		  keymap.set("n", "]d", vim.diagnostic.goto_next, opts) -- jump to next diagnostic in buffer

		  opts.desc = "Show documentation for what is under cursor"
		  keymap.set("n", "K", vim.lsp.buf.hover, opts) -- show documentation for what is under cursor
		end

		local capabilities = cmp_nvim_lsp.default_capabilities()

		lspconfig["html"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})

		-- configure typescript server with plugin
		lspconfig["tsserver"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})

		-- configure css server
		lspconfig["cssls"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})

		-- configure tailwindcss server
		lspconfig["tailwindcss"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})


		lspconfig["prismals"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})

		lspconfig["emmet_ls"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		  filetypes = { "html", "typescriptreact", "javascriptreact", "css", "sass", "scss", "less", "svelte" },
		})

		lspconfig["pyright"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		})

		lspconfig["lua_ls"].setup({
		  capabilities = capabilities,
		  on_attach = on_attach,
		  settings = { -- custom settings for lua
			Lua = {
			  -- make the language server recognize "vim" global
			  diagnostics = {
				globals = { "vim" },
			  },
			  workspace = {
				-- make language server aware of runtime files
				library = {
				  [vim.fn.expand("$VIMRUNTIME/lua")] = true,
				  [vim.fn.stdpath("config") .. "/lua"] = true,
				},
			  },
			},
		  },
		})

		lspconfig["clangd"].setup({
			capabilities = capabilities,
			on_attach = on_attach
		})

	end
}
