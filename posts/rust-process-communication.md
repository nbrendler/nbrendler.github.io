---
title: "Dealing with long-lived child processes in Rust: Part 1"
date: 2019-11-02T04:17:12Z
description: Notes on dealing with child processes that I found a bit tricky or
  not documented well.
layout: layouts/post.njk
permalink: rust-process-communication/
tags:
  - tech
  - rust
---

I've been writing a small program in Rust to fill a need I have with my current
setup (a terminal-based chat client for Keybase). It's my first foray into some
areas of Rust like async and spawning child processes, and also my first
terminal UI.

One requirement of the program was to run a background process (the chat
listener) that would communicate back to the main process when it received an
event (a new chat message). Most child processes in my experience are usually a
one-and-done affair. Run it, collect the output and be on your merry way. Here I
had a need to keep it running in the background, send the output asynchronously
to my UI thread, and make sure to clean up the process when my program exits.

This all ended up being a bit tricky for an unexperienced Rust programmer like
me, so I'm documenting a few of the challenges and approaches I tried to solve
it, along with what I ended up with.

For this Part 1, I'll talk about different ways to communicate with the
processes. Part 2 will cover signal handling to clean up the processes when the
main process is interrupted.

### Async communication with processes

Problem: After spawning a child process, how should it communicate back to the
main process?

The Rust documentation for the
[process](https://doc.rust-lang.org/std/process/index.html) module is all
blocking and waiting for child output, but a quick search gives you a few
options: callbacks, channels, or tokio (streams and async/await).

For a simple cases, callbacks should be the first thing you reach for.  Here's
an example where I grab a line from stdout and send it back with my callback.

```rust
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;
use std::thread::sleep;
use std::time::Duration;

fn start_listener<T: 'static + Send + Fn(&str)>(cb: T) {
    let child = Command::new("ping")
        .arg("google.com")
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to start ping process");

    println!("Started process: {}", child.id());

    thread::spawn(move || {
        let mut f = BufReader::new(child.stdout.unwrap());
        loop {
            let mut buf = String::new();
            match f.read_line(&mut buf) {
                Ok(_) => {
                    cb(buf.as_str());
                }
                Err(e) => println!("an error!: {:?}", e),
            }
        }
    });
}

fn main() {
    start_listener(|s| {
        println!("Got this back: {}", s);
    });

    sleep(Duration::from_secs(5));
    println!("Done!");
}
```

This is a bit contrived, but there's still a few things to unwrap.
  * We sleep for five seconds to let `ping` give us something to look at, but in
      a real program we could be doing other things -- in my case, running the
      rendering loop for the terminal UI.
  * We're not doing anything interesting in the callback. Just printing is a bit
      of a cop-out, because you won't run afoul of any ownership constraints
      imposed by Rust. Note how the callback is required to have a static
      lifetime (because the thread could have a static lifetime), so the
      compiler will likely yell at us if we tried to do anything interesting.
  * We're not doing any cleanup of the `Child` process, so the `ping` command
      will continue to run forever until killed. I believe this is handled by
      Cargo in simple cases like this, but we need to handle it ourselves as
      Cargo won't always be running the binary for us.

Here's the same thing, but now we're using a channel instead of a callback.

```rust
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::thread;

fn start_listener(sender: Sender<String>) {
    let child = Command::new("ping")
        .arg("google.com")
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to start ping process");

    println!("Started process: {}", child.id());

    thread::spawn(move || {
        let mut f = BufReader::new(child.stdout.unwrap());
        loop {
            let mut buf = String::new();
            match f.read_line(&mut buf) {
                Ok(_) => {
                    sender.send(buf).unwrap();
                }
                Err(e) => println!("an error!: {:?}", e),
            }
        }
    });
}

fn main() {
    let (tx, rx) = channel();
    start_listener(tx);

    for line in rx {
        println!("Got this back: {}", line);
    }

    println!("Done!");
}
```

> Update (2020-08-12): [@mezeipetister](https://twitter.com/mezeipetister)
> pointed out we can just use the iterator provided by the channel to simplify
> the main function here (and in the next example). Thanks!

Note that this will run forever until you hit Ctrl-C, so our 'Done!' will never
be reached. It is possible to use a timeout to get the same behavior as above,
but I haven't implemented it here.

This is what I ended up settling on for my program, as it gives a little bit
more flexibility. The channel parts can be very cheaply cloned and stored in
other structs if desired. The [crossbeam](https://crates.io/crates/crossbeam)
crate, which is a mostly drop-in replacement for the message-based tools
included in the standard library, has a `select!` macro that nicely encapsulates
the loop logic, and is purportedly much faster.

### Bidirectional communication

Problem: What if I want to be able to send more information to the process via
stdin, while still getting information back from it?

While you could accomplish this using callbacks, this is more of a textbook case
for using channels. Below I've modified our example to work as more of an echo
server. We send it input that will be echoed back after a delay. Note that we
now need two channels, one to send information to the child, and one for the
child to send back to us.

```rust
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Mutex;

use std::thread;
use std::thread::sleep;
use std::time::Duration;

fn start_process(sender: Sender<String>, receiver: Receiver<String>) {
    let child = Command::new("cat")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to start process");

    println!("Started process: {}", child.id());

    thread::spawn(move || {
        let mut f = BufReader::new(child.stdout.unwrap());
        let mut stdin = child.stdin.unwrap();
        for line in receiver {
            stdin.write_all(line.as_bytes()).unwrap();
            let mut buf = String::new();
            match f.read_line(&mut buf) {
                Ok(_) => {
                    sender.send(buf).unwrap();
                    continue;
                }
                Err(e) => {
                    println!("an error!: {:?}", e);
                    break;
                }
            }
        }
    });
}

fn start_command_thread(mutex: Mutex<Sender<String>>) {
    thread::spawn(move || {
        let sender = mutex.lock().unwrap();
        sleep(Duration::from_secs(3));
        sender
            .send(String::from("Command from the thread\n"))
            .unwrap();
    });
}

fn main() {
    let (tx1, rx1) = channel();
    let (tx2, rx2) = channel();

    start_process(tx1, rx2);

    tx2.send(String::from("Command 1\n")).unwrap();
    start_command_thread(Mutex::new(tx2));

    for line in rx1 {
        println!("Got this back: {}", line);
    }
}
```

Note that we have to use a mutex because `Send` is not implemented for the
sender objects. This is also done by crossbeam, but I wanted to avoid extra
crates for the example. I'm also cloning the sender somewhat unnecessarily to
avoid it being dropped (and closing the channel) when the command thread
finishes.

This is mostly there now, minus one problem. If you grep for `cat` processes,
you probably have a few zombified processes lingering around. In part 2 we'll
discuss signal handling and the cleanup.
