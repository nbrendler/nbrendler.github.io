---
title: On productivity
date: 2020-03-16T15:23:44Z
description: Attempting to solve non-technical problems with technology.
tags:
  - tech
---

Lately I've been struggling a bit to be productive. I've got lots of stuff I
want to make between games, resume-building JS projects and updating the
look-and-feel of this here blog, but my time is not structured like it used to
be after having a kid. Having only a few blocks of time here and there has
forced me to reevaluate how I spend my time on the computer.

My old workflow usually resembled something like this:
1. Log on, check reddit and/or twitter.
2. Read a few interesting things.
3. Time passes.
4. Alright I guess I better do something now!
5. Work for a few hours.

I've gotten pretty far using this technique but it breaks down pretty quickly
when I'm limited to _maybe_ two hours depending on nap timings. The real bane
of productivity has been this dreaded pattern:

```
0. Start coding
1. Oh, this problem is hard
2. Better check reddit while I think
3. What was I doing again?
4. goto 0
```

Sound familiar? After a couple iterations of this loop I've already wasted most
of my coding time. Overcoming it requires some mental discipline that can be
tough when cooped up at home and working independently, especially if I'm not
super enthused about the problem I'm trying to solve.. But rather than confront
my feelings or ponder why my intrinsic motivation might be lacking, being a
programmer I naturally chose to attempt to fix this with technology.

You guessed it, I'm talking about DNS blacklisting! It's actually really simple
to block yourself from accessing sites that you tend to get sucked into. I used
to have two different hosts files sitting around that looked like this
``` bash
# /etc/hosts.focus
127.0.0.1 reddit.com
127.0.0.1 www.reddit.com
127.0.0.1 twitter.com
127.0.0.1 www.twitter.com

# and so on
```
```bash
# /etc/hosts.unfocus
127.0.0.1 localhost
```

Then make `/etc/hosts` a symlink that points to whichever one I need at the
time. This may or may not work for you depending on your level of
self-discipline. Sometimes I would "forget" to turn it back on. But what it
does help with is my fingers subconsciously typing 'reddit.com' before my brain
catches on. Seeing the 404 page serves as a gentle reminder that I shouldn't be
doing that right now.

Recently I decided to start using `dnsmasq` to do local DNS on my machine. You
can set up the same deal using their config:
```
# /etc/dnsmasq.conf
...

# BLACKLIST -- not specifying an ip forces them to not resolve
address=/twitter.com/
address=/www.twitter.com/
address=/reddit.com/
address=/www.reddit.com/
...
```

So far this has hit the sweet spot for me of being just annoying enough to
change back that I haven't turned it off. I would have to edit the config,
comment out those lines, then restart the service (and maybe clear the DNS cache,
depending).

Sometimes mildly inconveniencing yourself can be an effective agent of
change.
