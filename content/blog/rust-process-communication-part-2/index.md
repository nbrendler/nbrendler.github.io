---
title: "Dealing with long-lived child processes in Rust: Part 2"
date: 2019-12-27T04:13:27Z

description: How to handle signals so that child processes get cleaned up.
tags:
  - tech
  - rust
---

In [part one](/rust-process-communication) I went over a few of the methods I
tried for communicating between different processes in Rust. These all worked
great with one caveat -- the child process doesn't always get cleaned up.

I originally thought I wouldn't have to deal with this, because I didn't see
them in the process list; however, I didn't know that [Cargo automatically
cleans up child processes](https://github.com/rust-lang/cargo/issues/5598), but
it turns out that this isn't always the case. I believe if your main program
exits successfully, the child processes are not cleaned up, which probably makes
sense for some use cases. In my case, I needed them to be closed , so I figured
it's better to be explicit and figure out how to clean them up rather than rely
on a feature of Cargo.

To remedy this I introduced the `signal-hook` crate with its very simple
interface.

```rust
use std::io::{BufRead, BufReader, Error, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::{atomic::AtomicBool, atomic::Ordering, Arc, Mutex};

use std::thread;
use std::thread::sleep;
use std::time::Duration;

use signal_hook::SIGTERM;

fn start_process_thread(child: &mut Child, sender: Sender<String>, receiver: Receiver<String>) {
    let mut stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    thread::spawn(move || {
        let mut f = BufReader::new(stdout);
        loop {
            match receiver.try_recv() {
                Ok(line) => {
                    stdin.write_all(line.as_bytes()).unwrap();
                }
                Err(TryRecvError::Empty) => {
                    sleep(Duration::from_secs(1));
                    continue;
                }
                Err(e) => {
                    println!("Error: {:?}", e);
                }
            }
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

fn start_process(sender: Sender<String>, receiver: Receiver<String>) -> Child {
    let mut child = Command::new("cat")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to start process");

    start_process_thread(&mut child, sender, receiver);
    println!("Started process: {}", child.id());

    child
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

fn main() -> Result<(), Error> {
    let (tx1, rx1) = channel();
    let (tx2, rx2) = channel();

    let mut child = start_process(tx1, rx2);

    tx2.send(String::from("Command 1\n")).unwrap();
    start_command_thread(Mutex::new(tx2.clone()));

    let should_terminate = Arc::new(AtomicBool::new(false));
    signal_hook::flag::register(SIGTERM, Arc::clone(&should_terminate))?;

    while !should_terminate.load(Ordering::Relaxed) {
        match rx1.try_recv() {
            Ok(line) => {
                println!("Got this back: {}", line);
            }
            Err(TryRecvError::Empty) => {
                sleep(Duration::from_secs(1));
                continue;
            }
            Err(e) => {
                println!("Error: {:?}", e);
            }
        }
    }

    child.kill()?;
    Ok(())
}
```

This has undergone a few minor changes.

1. The `start_process` method now results the child it creates, so that we can
   kill it later. You could also store this handle in another data structure,
   too.
2. The thread-launching function was split in two. One of them starts the
   process and gives a mutable reference to the second function. The second
   function grabs the stdin and stdout streams from the process and gives those
   to the thread, without taking ownership of the whole child process object.
3. We changed the main loop to check a bool whether or not it should continue.
   The `signal-hook` crate gives the ability to flip this bool when a SIGTERM is
   received, such as Ctrl-C from the terminal.
4. Now we can kill the child at the end of the main function, since the loop
   finishing means we're all done.

This isn't totally foolproof. The operating system could kill the program to
reclaim resources by sending a SIGKILL (which processes cannot prevent), so our
cleanup line won't run. But under normal operations the child will be closed.

The tricky part for me when writing this was (2). How can I keep a reference to
the child around (for killing it later), while still giving the thread ownership
over the io streams it needs to work? In this case, I think what I've done is
the simplest, just surgically removing the streams from the child and giving
them to the thread. If that won't work for what you're doing (maybe multiple
children need to read or write to the streams), you can probably just wrap the
child object in a thread-safe container like `Arc<Mutex>`.

I tend to reach for things like `Arc<Mutex>` (or dynamic dispatch with `Box<dyn
trait>`, for other problems) as a last resort while still learning the ins and
outs of Rust, because to me the best way to improve is to better understand the
borrow checker and what it's telling you, and things like `Arc<Mutex>` feel like
breaking the rules. However, there are times when they are the right tool for
the job and this is probably one of them.
