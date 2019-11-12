---
title: Kernel status script
date: 2019-09-23T04:02:43Z
description: I often forget to restart after updating the kernel, so I wrote a
  script to check the status and put it in xmobar config to remind me.
tags: tech,arch linux
---

When developing on Arch Linux, kernel updates happen pretty frequently. For most
things, this is fine and I can continue working. For some things, notably
Docker, I need to reboot my machine after the kernel is updated. This probably
depends on what storage driver you use and such, but currently I use overlayfs
which is loaded by the kernel. You might be able to get away with just modprobe
but I tend to just restart as it's quick and easy.

To remind myself when this happens, I wrote this script:
```bash
#!/bin/bash

[[ `pacman --query linux` =~ ^(.*)([0-9]+[0-9]?\.[0-9]+[0-9]?\.[0-9]+[0-9]?)(.*)$ ]] && installed_kernel=${BASH_REMATCH[2]};

[[ `uname --kernel-release` =~ ^(.*)([0-9]+[0-9]?\.[0-9]+[0-9]?\.[0-9]+[0-9]?)(.*)$ ]] && running_kernel=${BASH_REMATCH[2]};

if [[ "$running_kernel" != "$installed_kernel" ]];
then
  echo "Restart ($installed_kernel)"
else
  printf "OK ($running_kernel)"
fi
```

This will print out `OK (5.3.1)` if my installed kernel matches the running one,
or `Restart (5.3.1)` if my running kernel is older. Then I added the script to
my path and call it in xmobar config like so:

```
Run Com "kernelstatus" [] "kernel" 1000
```

And now I can see it in my status bar:

![The kernel status](./xmobar.png)

I haven't figured out an _easy_ way to color the output of a custom command like
this in xmobar (without dusting off my Haskell skills), but will update if I do.

Update (2019-11-12): Arch changed the version string returned by `pacman --query
linux` to no longer contain the word `arch`, so here's an updated script:

```bash
#!/bin/bash

# e.g. linux 5.3.10.1-1
[[ `pacman --query linux` =~ ^(.*)([0-9]+[0-9]?\.[0-9]+[0-9]?\.[0-9]+[0-9]?)(\.[0-9]+-[0-9]+)(.*)$ ]] && installed_kernel=${BASH_REMATCH[2]};

# e.g. 5.3.10-arch1-1
[[ `uname --kernel-release` =~ ^(.*)([0-9]+[0-9]?\.[0-9]+[0-9]?\.[0-9]+[0-9]?)(.*)$ ]] && running_kernel=${BASH_REMATCH[2]};

if [[ "$running_kernel" != "$installed_kernel" ]];
then
  echo "Restart ($installed_kernel)"
else
  printf "OK ($running_kernel)"
fi

```
