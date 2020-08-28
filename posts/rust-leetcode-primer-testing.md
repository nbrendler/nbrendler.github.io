---
title: "Rust/Leetcode Primer: Testing Solutions"
date: 2020-08-28T01:51:04Z
description: Tips on how to effectively test your Rust leetcode solutions.
layout: layouts/post.njk
tags:
  - tech
  - rust
---

One problem I encountered after starting to work on solving various
[leetcode](https://www.leetcode.com) problems with Rust is that my normal
workflow doesn't translate well to the online editor. The compiler errors are
sometimes truncated, and if your code panics, you don't get any information back
at all, other than the panic message (not even a line number!). So I spent some
time optimizing my workflow and consolidated this into a list of tips.

I'll present these in the context of [this
problem](https://leetcode.com/problems/minimum-time-to-collect-all-apples-in-a-tree/).
The solution I came up with is "DFS with extra steps" as we'll see below.

## Write your code as examples

I have set up a `rust-playground` cargo project on my machine, and when I work
on a new problem, I can whip up a new example by creating `apple-picking.rs` in
the `examples` folder in the project root. These are nicely isolated from each
other and can be run with `cargo run --example apple-picking` or `cargo test
--example apple-picking`. This way, I don't have to `cargo install` anything new
unless I need it for that example, and you can even go the extra mile by writing
shared code in the actual project source, if you get tired of writing binary
search for the umpteenth time.

## Don't waste time trying to parse stdin

The leetcode test runner has stdin parsing built in, so you only need to input
text to create a testcase. Doing this in Rust is a bit tricky for anything more
complicated than whitespace- or comma-delimited numbers -- parsing a
`Vec<Vec<i32>>`, for example. Rather than whip out `serde` to try and parse this
stuff to be able to run your function, I think it's easier to just use the
builtin Rust test tools and define your test case natively as shown below.

## Use the builtin test framework

For testing my answer prior to submitting, I like to use a macro in combination
with the builtin `#[test]` attribute. With a few tweaks this can be adopted to
pretty much any leetcode problem.

To start off, we are given this function signature by the problem:
```rust
impl Solution {
  pub fn min_time(n: i32, edges: Vec<Vec<i32>>, has_apple: Vec<bool>) -> i32 {
  }
}
```

To create a macro for testing, I started with this template [from SO](https://stackoverflow.com/questions/34662713/how-can-i-create-parameterized-tests-in-rust) for testing a hypothetical fibonacci number generator:
```rust
macro_rules! fib_tests {
    ($($name:ident: $value:expr,)*) => {
    $(
        #[test]
        fn $name() {
            let (input, expected) = $value;
            assert_eq!(expected, fib(input));
        }
    )*
    }
}

fib_tests! {
    fib_0: (0, 0),
    fib_1: (1, 1),
    fib_2: (2, 1),
    fib_3: (3, 2),
    fib_4: (4, 3),
    fib_5: (5, 5),
    fib_6: (6, 8),
}
```

My macro-fu is amateur at best, but I modified this to work for this leetcode
problem, and added a bunch of tests on top of the given examples:
```rust
macro_rules! run_tests {
    ($($name:ident: $value:expr,)*) => {
    $(
        #[test]
        fn $name() {
            let (input, expected) = $value;
            let (n, edges, has_apple) = input;
            assert_eq!(expected, min_time(n, edges.iter().map(|s: &[i32; 2]| s.to_vec()).collect(), has_apple.to_vec()));
        }
    )*
    }
}

run_tests! {
    example_1: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false,false,true,false,true,true,false]), 8),
    example_2: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false,false,true,false,false,true,false]), 6),
    all_apples: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [true, true, true, true, true, true, true]), 12),
    no_apples: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false, false, false, false, false, false, false]), 0),
    root_apple: ((1, [], [true]), 0),
    root_no_apple: ((1, [], [false]), 0),
    small_1: ((2, [[0,1]], [true, false]), 0),
    small_2: ((2, [[0,1]], [false, true]), 2),
    small_3: ((2, [[0,1]], [true, true]), 2),
    non_binary: ((4, [[0,1], [0,2], [0,3]], [false,true,true,true]), 6),
}
```

Now I can run `cargo test --example apple-picking` and get a much tighter
feedback loop than what's possible in the online editor. You could also use
`cargo watch`, if you have it installed, .e.g. `cargo watch -x "test --example
apple-picking"`.

## Use property-based testing

It's a bit tricky for graph/tree problems, but for a large subset of problems on
leetcode (those that deal with strings, or arrays of integers, for example), you
can get a lot of mileage out of property-based testing crates like
[quickcheck](https://lib.rs/crates/quickcheck) to help with testing before
submitting. More on this in a future post.

# The Result

After setting this up, I was able to solve the problem rather painlessly. My
first solution had a panic:
```rust

pub fn min_time(_n: i32, edges: Vec<Vec<i32>>, has_apple: Vec<bool>) -> i32 {
    let mut adj_list: HashMap<usize, Vec<usize>> = HashMap::new();

    for e in edges {
        adj_list
            .entry(e[0] as usize)
            .or_insert_with(Vec::new)
            .push(e[1] as usize);
    }

    fn helper(
        root: usize,
        visited: &mut HashSet<usize>,
        adj: &HashMap<usize, Vec<usize>>,
        apples: &[bool],
    ) -> i32 {
        if adj.get(&root).is_none() || adj[&root].is_empty() {
            if apples[root] && root != 0 {
                return 2;
            }
            return 0;
        }
        let mut s = 0;

        for child in adj[&root].iter() {
            if !visited.contains(child) {
                visited.insert(*child);
                s += helper(*child, visited, adj, apples);
            }
        }
        if root == 0 {
            return s;
        }
        if s > 0 || apples[root] {
            return s + 2;
        }
        0
    }
    let mut visited = HashSet::new();
    visited.insert(0);

    helper(0, &mut visited, &adj_list, &has_apple)
}
```

When run in the online editor, I would only see the message `no entry found for
key`, which (in this case) was a big enough hint to figure the problem out, but
when run with the tests and `RUST_BACKTRACE=1`, I get a lot more helpful
information:
```bash

running 10 tests
test all_apples ... ok
test example_2 ... ok
test example_1 ... ok
test no_apples ... ok
test small_1 ... ok
test small_2 ... ok
test non_binary ... ok
test small_3 ... ok
test root_no_apple ... FAILED
test root_apple ... FAILED

failures:

---- root_no_apple stdout ----
thread 'root_no_apple' panicked at 'no entry found for key', /rustc/cd1ef390e731ed77b90b11b1f77e2c5ca641b261/src/libstd/collections/hash/map.rs:1025:9
stack backtrace:
  # several frames omitted
  17: apple_picking::min_time::helper
             at examples/apple-picking.rs:36
  18: apple_picking::min_time
             at examples/apple-picking.rs:61
  19: apple_picking::root_no_apple
             at examples/apple-picking.rs:10
  # several frames omitted
note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.

---- root_apple stdout ----
thread 'root_apple' panicked at 'no entry found for key', /rustc/cd1ef390e731ed77b90b11b1f77e2c5ca641b261/src/libstd/collections/hash/map.rs:1025:9
stack backtrace:
  # several frames omitted
  17: apple_picking::min_time::helper
             at examples/apple-picking.rs:36
  18: apple_picking::min_time
             at examples/apple-picking.rs:61
  19: apple_picking::root_apple
             at examples/apple-picking.rs:10
  # several frames omitted
note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.


failures:
    root_apple
    root_no_apple

test result: FAILED. 8 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out
```

Armed with the line number, we can see that I forgot to check if the hashmap key
exists before attempting to get the value.

```rust
// the key will only be set if the index (root) appears in an edge, so check for
// None, too
if adj.get(&root).is_none() || adj[&root].is_empty() {
    if apples[root] && root != 0 {
        return 2;
    }
    return 0;
}
```

After fixing this, I was feeling pretty good and submitted my answer, but I was
greeted by my old friend `Wrong Answer` (his partner in crime, `Time Limit
Exceeded` hasn't been coming by as much since I switched from Python to Rust!). I
hadn't considered the case where we need to traverse an edge in reverse,
depending on the tree setup, and incorrectly reported `0`. Thankfully it's easy
to just add this failing test and then fix my code up:
```rust
run_tests! {
    example_1: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false,false,true,false,true,true,false]), 8),
    example_2: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false,false,true,false,false,true,false]), 6),
    all_apples: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [true, true, true, true, true, true, true]), 12),
    no_apples: ((7, [[0,1],[0,2],[1,4],[1,5],[2,3],[2,6]], [false, false, false, false, false, false, false]), 0),
    root_apple: ((1, [], [true]), 0),
    root_no_apple: ((1, [], [false]), 0),
    small_1: ((2, [[0,1]], [true, false]), 0),
    small_2: ((2, [[0,1]], [false, true]), 2),
    small_3: ((2, [[0,1]], [true, true]), 2),
    non_binary: ((4, [[0,1], [0,2], [0,3]], [false,true,true,true]), 6),
    // NEW TEST!
    reversed_edge: ((4, [[0,2],[0,3],[1,2]], [false, true, false, false]), 4),
}
```

and then fix my code by adding the reverse edge to the adjacency list:
```rust
for e in edges {
    adj_list
        .entry(e[0] as usize)
        .or_insert_with(Vec::new)
        .push(e[1] as usize);
    // but also do this
    adj_list
        .entry(e[1] as usize)
        .or_insert_with(Vec::new)
        .push(e[0] as usize);
}
```

Success! Unfortunately, this was not the best or most efficient answer by a long
shot (only beats 20%/20% on leetcode for CPU/memory). We can use a plain old
array instead of a hashmap since the keys are just vertex indices. I think you
can also skip the hashset entirely if you carefully construct the adjacency
list. There's no shame in looking at other solutions to figure out how to
optimize yours!

Regardless, I've found this to be a nice template for solving the problems
offline and will continue using it!
