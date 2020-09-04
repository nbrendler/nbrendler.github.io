---
title: "Using quickcheck to test Leetcode solutions"
date: 2020-09-04T11:39:26Z
layout: layouts/post.njk
description: Quick example on how to use property-based testing tools like
  quickcheck to help find edge cases that break your code.
tags:
  - tech
  - rust
---

In [my previous post](/posts/rust-leetcode-primer-testing/) I alluded to the
utility of [quickcheck](https://github.com/BurntSushi/quickcheck) when testing
your leetcode or other competitive programming solutions.

Property-based testing tools like this allow you to define (in code) certain
invariants or properties about the code you're testing, and then test it with a
huge amount of pseudo-random input. While this is especially useful for simple
code that must deal with large, unknown inputs (like parsing strings, for
example), it can also be helpful with some problems to help discover edge cases.

## Example

Let's walk through another example from leetcode, [(#1043) Partition Array for
Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/).
This is a typical dynamic programming sort of problem. Here's the solution I
came up with in Rust:

```rust
pub fn max_sum_after_partitioning(arr: &[i32], k: i32) -> i32 {
    let k = k as usize;
    let mut dp = vec![0; arr.len() + 1];

    for i in 1..=arr.len() {
        // look at the previous k items (i - 1, i - 2, ... i - k)
        for j in 1..=k.min(i) {
            // dp[i] contains the answer for the subarray [0..i-1]
            dp[i] = dp[i].max(dp[i - j] + j as i32 * arr[(i - j)..i].iter().max().unwrap())
        }
    }

    dp[arr.len()]
}
```

Note: I changed the method signature to more ergonomically work with slices in
my local tests. So how *do* we test it? Well, we can add some manual tests like
we did in the previous post:

```rust
macro_rules! run_tests {

    ($($name:ident: $value:expr,)*) => {
    $(
        #[test]
        fn $name() {
            let (input, expected) = $value;
            let (arr, k) = input;
            assert_eq!(expected, max_sum_after_partitioning(&arr, k));
        }
    )*
    }
}

run_tests! {
    example_1: (([1,15,7,9,2,5,10], 3), 84),
    example_2: (([1,4,1,5,7,3,6,1,9,9,3], 4), 83),
    example_3: (([1], 1), 1),
}
```

That's helpful, but boring! Let's add some property-based tests. This is a bit
hard for this problem, because we can't describe "the answer" as an invariant
without just solving the problem in the first place. The naive solution that
considers all possible subarrays has N^3 time complexity, so quickcheck will
likely be very slow (but possible!). It can more easily, however, tell us that
our code won't panic, and we can think about what the lower/upper bounds of
output should be and check that it doesn't exceed those.

With that said, here's a quickcheck test for this solution:

```rust
use quickcheck::TestResult;
#[macro_use(quickcheck)]
extern crate quickcheck_macros;

#[quickcheck]
fn bound_checks(xs: Vec<i32>, k: i32) -> TestResult {
    if k <= 0 {
        return TestResult::discard();
    }
    let max_value = xs.iter().max().unwrap_or(&0).abs();
    let min_value = xs.iter().min().unwrap_or(&0).abs();
    let abs_max = max_value.max(&min_value);
    let L = xs.len() as i32;
    TestResult::from_bool(
        max_sum_after_partitioning(&xs, k).abs() <= L * abs_max
    )
}
```

I know that the absolute value of my sum shouldn't exceed the length of the list
times the largest (or smallest) value, so we can include that as a bound for the
test to check. The problem parameters also tell us that `k` can't be less than
0, so we tell quickcheck to discard any input which doesn't match up (it would
be nice if leetcode used an unsigned type!).

Then we can run the test (and crank up the input using `QUICKCHECK_TESTS`, if
you wish):

```bash
QUICKCHECK_TESTS=10000 cargo test --example partition-subarray
```

Success! If we want to be sure it's working, let's add a weird bug to our
solution that we might not catch manually:

```rust

pub fn max_sum_after_partitioning(arr: &[i32], k: i32) -> i32 {
    let k = k as usize;
    let mut dp = vec![0; arr.len() + 1];

    for i in 1..=arr.len() {
        // look at the previous k items (i - 1, i - 2, ... i - k)
        for j in 1..=k.min(i) {
            // dp[i] contains the answer for the subarray [0..i-1]
            dp[i] = dp[i].max(dp[i - j] + j as i32 * arr[(i - j)..i].iter().max().unwrap())
        }

        if i > 30 {
          panic!("What a big number!")
        }
    }

    dp[arr.len()]
}
```

Then our quickcheck test should find the problem:

```bash
thread 'bound_checks' panicked at 'What a big number!', examples/partition-subarray.rs:18:13
thread 'bound_checks' panicked at '[quickcheck] TEST FAILED (runtime error). Arguments: ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1)
```

This can be very useful for certain types of problems that are sensitive to
boundary values. It's even better if there's an easy, naive solution that you
can write. Many problems have a quadratic solution that is obvious to implement.
Then your quickcheck test can run the slow but obviously correct algorithm to
check the work of your fancy algorithm, giving you a lot more confidence that
it's correct!
