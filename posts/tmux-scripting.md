---
title: "Tmux Scripting"
date: 2020-09-18T01:25:00Z
description: Tips for setting up workspaces in tmux without any plugins
layout: layouts/post.njk
tags:
  - tech
  - tmux
  - vim
---

My workflow is primarily terminal-based, so I spend most of my time in Vim with
tmux and don't typically use an IDE. I discovered embarrassingly late that you
can script the creation of tmux screens to avoid having to create the same setup
from scratch all the time.

For example, I use this script when I want to work on my blog:
```bash
!/bin/bash
base_path="~/src/nbrendler.github.io"
SESSION='blog'
tmux -2 new-session -d -s $SESSION

tmux rename-window "Main"
tmux send-keys "cd $base_path; vim" C-m

tmux split-window -v
tmux send-keys "cd $base_path; eleventy --serve" C-m
tmux split-window -h
tmux send-keys "cd $base_path; git status" C-m

tmux select-layout main-vertical
tmux select-pane -t 0

tmux -2 attach-session -t $SESSION
```

Now I can just type the word `blog` and everything spins up ready to go! For
some things at work where I might have multiple databases and services that need
to spin up, you can do something with multiple windows like this:

```bash
#!/bin/bash
base_path="~/src/myprogram"
service_path="~/src/myprogram/src/some-service"
SESSION='myprogram'

tmux -2 new-session -d -s $SESSION

tmux rename-window "UI"
tmux send-keys "cd $base_path; vim src/web" C-m

tmux split-window -v
tmux send-keys "cd $base_path; npm run dev" C-m
tmux split-window -h
tmux send-keys "cd $base_path; git status" C-m
tmux select-layout main-vertical

tmux new-window -n "Service"
tmux send-keys "cd $service_path; vim index.js" C-m
tmux split-window -v
tmux send-keys "cd $service_path; docker run -p 8000:8000 -d some-docker-container; npm run develop" C-m
tmux split-window -h
tmux send-keys "cd $service_path; git status" C-m

tmux select-layout main-vertical

tmux select-window -t "UI"
tmux select-pane -t 0

tmux -2 attach-session -t $SESSION
```

Of course, it's a bash script, so you can set other variables that apply only to
those sessions (like an AWS profile for work), and generally make it your own.

When building your own scripts, you can check out `tmux list-commands` to see
what the options are.
