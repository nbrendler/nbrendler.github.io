---
title: "Rust/Leetcode Primer: Trees"
date: 2020-08-17T00:16:45Z
description: Post description
layout: layouts/post.njk
tags:
  - tech
  - rust
  - algorithms
---

Lately I've been brushing up on data structures and algorithms by working
through problems on [leetcode](https://www.leetcode.com). I've solved about 150
or so problems using Python and now I've started to tackle them with Rust. I
wanted to write down some notes about Rust-specific idioms as I come across
them, as the rules about ownership and mutability can sometimes make problems
that are easy in Python or C++ tricky to solve in Rust.

# Trees

First, some definitions. When I mention 'trees', I'm talking about the `Tree`
data structure. To be precise, trees are connected, acyclic graphs with `N`
vertices and `N-1` edges. We usually think about trees going in one direction.
You start with a vertex (the `root`), and then navigate to that vertex's
`children`. A vertex with no children is called a `leaf`. On leetcode there are
many questions which ask about `binary` trees, where each vertex has 0-2
children (`left` and `right`), which is what we'll look at here. Most of the
ideas are easily generalized to N-ary trees.

![A typical binary tree (Source: Wikipedia, Public Domain)](/img/Binary_tree.svg)

There are several flavors of binary trees, like 'balanced', 'almost balanced',
'skewed', etc. that can change how you solve the problem, but the problems on
leetcode will usually explain precisely what the terms mean (with examples).

Luckily (and sometimes unluckily), leetcode defines the `TreeNode`
implementation for you in all the problems I've seen, and it goes like this:

```rust
// Definition for a binary tree node.
#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
  pub val: i32,
  pub left: Option<Rc<RefCell<TreeNode>>>,
  pub right: Option<Rc<RefCell<TreeNode>>>,
}

impl TreeNode {
  #[inline]
  pub fn new(val: i32) -> Self {
    TreeNode {
      val,
      left: None,
      right: None
    }
   }
 }
```

An `Option`  models the binary tree perfectly, as we have `left` and `right`
children which could be null (`None`), or else contain a subtree
(`Some(TreeNode)`). In practice, having a child be owned by its parent in the
Rust sense is not very easy to work with, so it's wrapped by
`Rc<RefCell<TreeNode>>`, which offers shared ownership of nodes via `Rc` and
interior mutability (we can break the rules about borrowing) with `RefCell`.

A typical tree problem will require you to push nodes onto stacks or queues, so
it just wouldn't really work without `Rc<RefCell<TreeNode>>` in safe Rust (it
depends, see Real World Trees below).

Let's see how to work with these things.

## Example - Working with the tree immutably

Let's work through an easy-level problem, [Same Tree
(#100)](https://leetcode.com/problems/same-tree/). You can go read the
definition and try to solve it, if you like.

For this problem, we want to check if two binary trees are 'the same', meaning
they have all the same values in the same tree structure.

The key observation to solving this problem is that you should traverse both
trees at the same time and compare pairs of nodes (one from tree A, and one from
tree B). As long as you traverse both trees in the same way, any pair you find
that doesn't match indicates the trees are not the same.

Here's my (accepted) solution using a stack (depth-first search).

```rust
use std::rc::Rc;
use std::cell::RefCell;

type MaybeNode = Option<Rc<RefCell<TreeNode>>>;

impl Solution {
    pub fn is_same_tree(p: MaybeNode, q: MaybeNode) -> bool {
        let mut stack = vec![];
        stack.push((p, q));
        while !stack.is_empty() {
            // unwrapping is safe because of our while condition
            let pair = stack.pop().unwrap();
            match pair {
                (Some(p), Some(q)) if p == q => {
                    stack.push((p.borrow().left.clone(), q.borrow().left.clone()));
                    stack.push((p.borrow().right.clone(), q.borrow().right.clone()));
                },
                (None, None) => {},
                _ => { return false; }
            }
        }
        true
    }
}
```

As you can see, this is similar to how you would write this in your typical
imperative language. I created a type alias to avoid typing
`Option<Rc<RefCell<TreeNode>>>` all the time. The only real ugly bit is dealing
with the `Rc<RefCell>>`s... can we make that better?

To start off, we can borrow `p` and `q` once each.

```rust
match pair {
    (Some(p), Some(q)) if p == q => {
        let p = p.borrow();
        let q = q.borrow();
        stack.push((p.left.clone(), q.left.clone()));
        stack.push((p.right.clone(), q.right.clone()));
    },
    (None, None) => {},
    _ => { return false; }
}
```

That's looking better already. Do we really need to clone them?

``` rust

match pair {
    (Some(p), Some(q)) if p == q => {
        let p = p.borrow();
        let q = q.borrow();
        stack.push((p.left, q.left));
        stack.push((p.right, q.right));
    },
    (None, None) => {},
    _ => { return false; }
}

error[E0507]: cannot move out of dereference of `std::cell::Ref<'_, TreeNode>`
  --> same-tree.rs:32:29
   |
32 |                 stack.push((p.borrow().left, q.borrow().left));
   |                             ^^^^^^^^^^^^^^^
   |                             |
   |                             move occurs because value has type `std::option::Option<std::rc::Rc<std::cell::RefCell<TreeNode>>>`, which does not implement the `Copy` trait
   |                             help: consider borrowing the `Option`'s content: `p.borrow().left.as_ref()`
```

Right... I have to borrow it somehow.

```rust
match pair {
    (Some(p), Some(q)) if p == q => {
        let p = p.borrow();
        let q = q.borrow();
        stack.push((&p.left, &q.left));
        stack.push((&p.right, &q.right));
    },
    (None, None) => {},
    _ => { return false; }
}

error[E0597]: `p` does not live long enough
  --> same-tree.rs:34:30
   |
34 |                 stack.push((&p.left, &q.left));
   |                              ^ borrowed value does not live long enough
35 |                 stack.push((&p.right, &q.right));
36 |             }
   |             -
   |             |
   |             `p` dropped here while still borrowed
   |             borrow might be used here, when `p` is dropped and runs the destructor for type `std::cell::Ref<'_, TreeNode>`
```

No dice. Same thing if you try to `as_ref()` the `Option`s. The problem is our
references get dropped at the end of the match, so we have to clone to put them
on the stack.

What if we traded our stack for the call stack, and used recursion?

```rust
use std::rc::Rc;
use std::cell::RefCell;

type MaybeNode = Option<Rc<RefCell<TreeNode>>>;

impl Solution {
    pub fn is_same_tree(p: MaybeNode, q: MaybeNode) -> bool {
        fn helper(p: &MaybeNode, q: &MaybeNode) -> bool {
            match (p, q) {
                (Some(p), Some(q)) if p == q => {
                    let p = p.borrow();
                    let q = q.borrow();

                    helper(&p.left, &q.left) && helper(&p.right, &q.right)
                },
                (None, None) => true,
                _ => false
            }
        }

        helper(&p, &q)
    }
}
```

This looks a lot nicer! We're able to dodge most of the `Rc<RefCell>` stuff
(just one immutable borrow) because the compiler is able to reason about
lifetimes more easily when we store the references on the call stack like this.

That's a bunch of words about how to work with the trees immutably. What if we
want to mutate them?

## Another example - Mutating the trees

Let's work through mutating trees in place in the context of another problem,
[Invert Binary Tree (#226)](https://leetcode.com/problems/invert-binary-tree/).

For this problem we have to mutate the tree in place to achieve the desired
result. You could build a new tree as you go, but you'd be wasting some memory.
The only real trick here is to traverse it correctly and make sure you don't
swap the same subtree twice.

Here's my (accepted) solution:
```rust
use std::rc::Rc;
use std::cell::RefCell;
type MaybeNode = Option<Rc<RefCell<TreeNode>>>;
impl Solution {
    pub fn invert_tree(mut root: MaybeNode) -> MaybeNode {
        fn helper(node: &mut MaybeNode) {
            if let Some(_node) = node {
                let mut _node = _node.borrow_mut();

                match (_node.left.take(), _node.right.take()) {
                    (None, None) => {}
                    (l, r) => {
                        _node.left = r;
                        _node.right = l;
                    }
                }
                helper(&mut _node.left);
                helper(&mut _node.right);
            }
        }
        helper(&mut root);
        root
    }
}
```

Recursion again makes for a nice, easy Rust solution. We can just borrow the
`RefCell` mutably, then `take` the option values, which leaves a `None` in place
and swap them. Bonus points to someone that can figure out how to use
`std::mem::swap` here, the other idiomatic way to swap variables in Rust (I
tried, and failed).

# Tree Traversal

So far we've used helper functions and recursion to do tree traversal, which
works fine for a lot of problems. In the previous section we did a preorder
traversal (root, left, right) to ensure we mutate the tree correctly. In fact,
I've found this template works fine for problems that require you to visit all
of the nodes in a given tree:

```rust
fn traverse(root: &MaybeNode) {
    if let Some(node) = root {

        let node = node.borrow();

        // PREORDER -- do something here

        traverse(&node.left);

        // INORDER -- do something here

        traverse(&node.right);

        // POSTORDER -- do something here

        // optionally, return a value or something
    }
}
```

Iterative approaches should also work fine at the (minimal) cost of extra
cloning.

A more idiomatic approach would probably create an IterMut object that lets us
iterate over the tree nodes mutably (and can hide all the reference counting
stuff). I'm still working out the details here, so more on this in the future.

# Real World Trees

Does this way of modeling trees match what you might see in a real crate? It
depends. The problem with `Rc<RefCell<TreeNode>>` is that it can panic at
runtime. For small, controlled problems like what we go through here, you can
usually "prove" (by thinking really hard) that your code doesn't panic because
the surface area is small.  For crates that create and work with big, messy
trees (like parsers, for example), it's better to stay in the land of
compile-time safety. I might reach for something like
[indextree](https://crates.io/crates/indextree), which does arena allocation
using a single `Vec` as a backing store and uses indices to keep track of all
the edges -- skipping `RefCell` altogether!

The big (and probably only) advantage of using `Rc<RefCell>` is that tree nodes
can outlive the graph or tree that they come from. This can come in handy for
leetcode problems where you want to quickly throw nodes into some other data
structure to implement your algorithm. A more measured approach that might
appear in real software would allocate the data structure required and ensure
the lifetimes match up with the arena-allocated tree nodes so that we could
freely store their references without the need for reference counting pointers.

It's worth pointing out, too, that for simple use cases you can model trees with
`Box<T>`. Boxes are more straightforward to work with but don't allow shared
ownership, and won't work for general graphs that might have cycles (which can
also cause problems for `Rc`!.

# More problems

Here's a few more tree problems that can be done in Rust using variations of the
methods above.

  * [Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/)
  * [Path Sum III](https://leetcode.com/problems/path-sum-iii/)
  * [Construct Binary Tree From Preorder and Inorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/)

Now make lots of trees and leave!
