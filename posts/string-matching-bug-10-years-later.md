---
title: "Finding a bug in core string matching function... 10 years later"
date: 2023-11-23
---

A <a href="https://github.com/ValveSoftware/source-sdk-2013/blob/0d8dceea4310fde5706b3ce1c70609d72a38efdf/sp/src/game/server/baseentity.cpp#L2972" target="_blank">core string matching function</a> that is used by Source engine's map logic system has been broken for at least 10 years. Source engine is used by many games, just one of those games <a href="https://main.fastdl.me/maps/" target="_blank">has over fifty thousand custom maps</a>. Yet, nobody has noticed this bug.

## The broken code

The code checks whether an entity name matches an query string. The query string is usually another entity name, but can end in a wildcard (*). Strings contain ASCII characters and the comparison is case insentitive. Check out the Github link above if you want the whole function. Here's the broken part:

```cpp
// ...
// Compare character from both strings, case insensitive.
unsigned char char1 = '8';
unsigned char char2 = 'X';
bool match = (char1 == char2) ||
             // Check uppercase
             (char1 - 'A' <= (unsigned char)'Z' - 'A' && char1 - 'A' + 'a' == char2) ||
             // Check lowercase
             (char1 - 'a' <= (unsigned char)'z' - 'a' && char1 - 'a' + 'A' == char2);
// match is true 0_o
```

The statement is pretty hard to parse in your head, so here it is simplified:

```cpp
bool matches = (56u == 88u) ||
               (-9 <= 25 && 88 == 88u) || // true
               (-41 <= 25 && 24 == 88u);

// char1 and char2 flipped
bool matches = (88u == 56u) ||
               (23 <= 25 && 120 == 56u) ||
               (-9 <= 25 && 56 == 56u); // true
```

The problem is found in the `<=` comparisons, which are meant to check whether the character is an uppercase or lowercase letter.

The left side is suppose to wrap around.

```cpp
unsigned char c = '8';
auto mystery_type     = c - 'A'; // -9 ❌
unsigned char charred = c - 'A'; // 247 ✅
```

## ... but shouldn't it work anyway?

The code clearly casts the right side to an `unsigned char`, right? When comparing unsigned and signed values, the signed value is cast to unsigned. For example:

```cpp
-9 <= 25  // true, both signed
-9 <= 25u // false, signed gets cast to unsigned (value: 4294967287u)
```

But the code has a mistake, it only casts the first character in `(unsigned char)'Z' - 'A'`. `'A'` is a `char`, which is signed <sup>1</sup>. Mixing unsigned and signed *should* result in an unsigned value. 

```cpp
// (unsigned int - int) -> unsigned int
typeid(0u - 1).name() // "unsigned int" (value: 4294967295u)
```

So it would make sense that `unsigned char - char` should produce an `unsigned char`. But this is not true, it actually produces an `int` (most of the time)! I recommend reading <a href="https://blog.knatten.org/2019/05/24/no-one-knows-the-type-of-char-char/" target="_blank">this awesome blog post</a> by Anders Schau Knatten that goes deeper into this weird quirk.

```cpp
// (unsigned char - char) -> int
typeid((unsigned char)0u - (char)1).name() // "int" (value: -1)
```

But wait, there's more! Comparisons also casts the `char` and `unsigned char` to `int` first before comparing.

```cpp
-9 <= 25u                               // false
(char)-9 <= (unsigned char)25u          // true
(unsigned char)-9 <= (unsigned char)25u // false, must cast to unsigned explicitly
```

## Why didn't anybody notice?

1. Only uppercase letters and numbers can be matched incorrectly. (`P = 0, Q = 1, R = 2, S = 3, T = 4, U = 5, V = 6, W = 7, X = 8, Y = 9`)
2. The strings have to be the same size (unless performing a wildcard query).
3. The strings have to have the buggy characters in the same position.

Most maps contain unique enough entity names like `MyAwesome8Ball` and `XGonGiveItToYa` that do not cause issues. Those names have the danger characters `X` and `8`, but they don't differ by one character. Even though there are hundreds of thousands of custom maps, the bug is still rare.

I only noticed this because it broke my favorite map :( The map was made around 2009, and it happened to have two entities called `f_pn8` and `f_pnX`, which are core to the gameplay logic of the map. The map still works on an older build of the engine.

## Why did it work before?

The function was not always like this. It was changed at some point between 2006 and 2013. In place of the case comparison was instead the C library's `tolower` <a href="https://github.com/TotallyMehis/Zombie-Master-1.2.1/blob/0a6379918512857b8f6bd3c9a42103feedc39c2b/dlls/baseentity.cpp#L2571C46-L2571C46" target="_blank">as seen in this old Source SDK 2006 based mod</a>. It explains why the map works in that version of the engine.

```cpp
char char1 = '8';
char char2 = 'X';
bool match = char1 == char2 || tolower(char1) == tolower(char2);
// match is false :)
```

Reason for the change must have been performance, right? So, <a href="https://github.com/TotallyMehis/benchmark-source-name-match" target="_blank">I wrote a small benchmark</a> to test it. Here are the results:

```text
867^2 string comparisons, 1000 iterations, in nanoseconds.
Name                    Min       Max       Med       Avg       Sum %
C lib tolower           2714800   4408800   2859800   2872244   199.1
Custom comparison       1323700   2034500   1437900   1442913   100.0
Custom comparison fixed 1345100   2335500   1440600   1474698   102.2
```

I ran the benchmark a few times on my Ryzen 7 7800X3D with MSVC v143, `/O2` on. The old `tolower` version seems to be <span style="text-decoration: underline">around two times slower</span>. Take that with a grain of salt, though, as I'm not very familiar with this sort of benchmarking.

Regardless, I would say that is a nice performance gain for a function that is potentially called thousands of times on a busy frame.

## Fixing it

Now that we know all that, we can finally fix the code. There is only one way to fix it.

```cpp
// Cast the left side to an unsigned char.
((unsigned char)(char1 - 'A') <= 'Z' - 'A' && char1 - 'A' + 'a' == char2) ||
((unsigned char)(char1 - 'a') <= 'z' - 'a' && char1 - 'a' + 'A' == char2);
```

<a href="https://github.com/ValveSoftware/source-sdk-2013/pull/498" target="_blank">I created a fix pull request in 2020</a> when I first discovered this, but back then I didn't quite understand the entire picture, so I ended up casting all of the `char` operations. 😅


[Test it yourself with this code.](https://gist.github.com/TotallyMehis/13fc9215595ff342309024c628d7520e)

---

<sup>1.</sup> Whether `char` is signed or unsigned depends on the platform and the compiler settings. The platforms Source engine games are built for `char` is signed, and no `char` related compiler flags are set AFAIK. :)
