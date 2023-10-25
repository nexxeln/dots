local opt = vim.opt

-- 2 spaces for each indentation
opt.shiftwidth = 4
-- insert 2 spaces for tab while editing
opt.tabstop = 4
opt.softtabstop = 4
opt.timeoutlen = 1000 -- time to wait for a mapped sequence to complete in milliseconds
opt.completeopt = "menuone,noselect" -- for autocomplete which we'll be doing in the future
opt.splitbelow = true -- force all horizontal splits to go below current window
opt.splitright = true -- force all vertical splits to go to the right of current window
opt.termguicolors = true -- enable 2 bit RGB colors, most modern terminal emulators support this
opt.autoindent = true -- auto indent when using `o` or `O`
opt.smartindent = true -- smart indenting
opt.wrap = false -- wrap lines
opt.cmdheight = 2 -- height of command bar
opt.fileencoding = "utf-8" -- encoding of files
opt.mouse = "a" -- enable mouse in all modes, for more options see :help 'mouse'
opt.ignorecase = true -- ignore case while searching
opt.smartcase = true -- ovveride ignore case if search pattern contains upper case characters
opt.number = true -- numbered lines
opt.relativenumber = true -- relative line numbers
opt.numberwidth = 4 -- number column width
opt.pumheight = 10 -- height of pop up menu
opt.scrolloff = 8 -- minimium number of lines above and below the cursor
opt.sidescrolloff = 8 -- minimum number of columns on the left and right of the cursor
opt.whichwrap:append("b,s,<,>,[,],h,l") -- see :help 'whichwrap'
opt.shortmess:append("c") -- see :help 'shortmess'
opt.showmode = false -- won't show the mode in the command bar
opt.clipboard = "unnamedplus" -- sync clipboard with system clipboard
opt.swapfile = false -- creates a swap file
opt.cursorline = true -- highlights the current line
opt.conceallevel = 0 -- to show text normally
opt.signcolumn = "yes" -- always show the sign column
opt.undofile = true -- persistent undo
opt.expandtab = false -- use tabs
opt.guicursor = "n-v-c-i:block" -- cursor style in different modes, see :help 'guicursor'

