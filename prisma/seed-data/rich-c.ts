import { R, type RichExperiment } from "./types";

export const C_RICH: RichExperiment[] = [
  {
    n: 7, objectives: ["Use loops to accumulate a product", "Choose a data type large enough for the result", "Handle edge cases such as 0!"], cos: ["CO2"],
    theory: {
      introduction: "The factorial of a non-negative integer n, written n!, is the product of all positive integers from 1 to n. It appears throughout counting problems, probability and series expansions.",
      definition: "n! = 1 × 2 × 3 × … × n for n ≥ 1, and 0! = 1 by definition.",
      concepts: ["Iteration with a for loop", "Accumulator variable initialised to the identity element (1 for multiplication)", "Integer overflow: 13! exceeds a 32-bit int, so unsigned long long is used (exact up to 20!)"],
      terminology: [["Accumulator", "A variable that collects a running result inside a loop"], ["Overflow", "When a result exceeds the range of its data type"]],
      working: "Start with result = 1. For every i from 1 to n, multiply result by i. After the loop, result holds n!.",
      applications: ["Permutations and combinations (nPr, nCr)", "Taylor series for sin, cos and e^x", "Probability calculations"],
      examples: "5! = 1 × 2 × 3 × 4 × 5 = 120",
    },
    problem: "Read a non-negative integer n (0 ≤ n ≤ 20) and print n!.",
    algorithm: ["Start", "Read n", "Set fact = 1", "For i = 1 to n: fact = fact × i", "Print fact", "Stop"],
    pseudocode: "READ n\nfact ← 1\nFOR i ← 1 TO n DO\n    fact ← fact × i\nEND FOR\nPRINT fact",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n/]\n  B --> C[fact = 1, i = 1]\n  C --> D{i <= n?}\n  D -- Yes --> E[fact = fact * i]\n  E --> F[i = i + 1]\n  F --> D\n  D -- No --> G[/Print fact/]\n  G --> H([Stop])",
    starter: R`#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // compute n! here
    return 0;
}
`,
    reference: R`#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1 || n < 0) return 1;
    unsigned long long fact = 1;
    for (int i = 1; i <= n; i++) fact *= i;
    printf("%llu\n", fact);
    return 0;
}
`,
    explanation: "unsigned long long holds values up to about 1.8 × 10^19, enough for 20!. The loop does not execute for n = 0, so the result stays 1, which correctly gives 0! = 1.",
    sampleInput: "5", sampleOutput: "120",
    tests: [["5", "120"], ["0", "1"], ["1", "1", true], ["10", "3628800", true], ["20", "2432902008176640000", true]],
    viva: [["Why is 0! equal to 1?", "It is the empty product, and keeps formulas such as nCr = n!/(r!(n−r)!) consistent."], ["Why use unsigned long long?", "Factorials grow very fast; int overflows after 12!."], ["What is the time complexity?", "O(n) multiplications."], ["How would you compute it recursively?", "fact(n) = n × fact(n−1) with base case fact(0) = 1."], ["What happens on overflow of unsigned types in C?", "The value wraps around modulo 2^N; it is not an error, so results become silently wrong."]],
  },
  {
    n: 8, objectives: ["Generate a sequence using previous terms", "Update multiple variables in a loop"], cos: ["CO2"],
    theory: {
      introduction: "The Fibonacci sequence begins 0, 1 and each subsequent term is the sum of the two preceding terms. It models growth processes and appears in algorithms and nature.",
      definition: "F(0) = 0, F(1) = 1, F(k) = F(k−1) + F(k−2) for k ≥ 2.",
      concepts: ["Keeping two previous values in variables", "Shifting values each iteration", "Iterative versus recursive computation"],
      working: "Keep a = 0 and b = 1. Print a, then compute next = a + b, set a = b and b = next. Repeat n times.",
      applications: ["Fibonacci search", "Modelling population growth", "Dynamic programming examples"],
      examples: "First 7 terms: 0 1 1 2 3 5 8",
    },
    problem: "Read n (1 ≤ n ≤ 90) and print the first n Fibonacci terms on one line separated by single spaces.",
    algorithm: ["Start", "Read n", "Set a = 0, b = 1", "Repeat n times: print a; next = a + b; a = b; b = next", "Stop"],
    pseudocode: "READ n\na ← 0; b ← 1\nFOR i ← 1 TO n DO\n    PRINT a\n    next ← a + b\n    a ← b; b ← next\nEND FOR",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n/]\n  B --> C[a=0, b=1, i=1]\n  C --> D{i <= n?}\n  D -- Yes --> E[/Print a/]\n  E --> F[next=a+b; a=b; b=next; i=i+1]\n  F --> D\n  D -- No --> G([Stop])",
    starter: R`#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // print the first n Fibonacci numbers
    return 0;
}
`,
    reference: R`#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    long long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        printf(i ? " %lld" : "%lld", a);
        long long next = a + b;
        a = b;
        b = next;
    }
    printf("\n");
    return 0;
}
`,
    explanation: "The conditional format string avoids a trailing space. long long is needed because F(90) is about 2.9 × 10^18.",
    sampleInput: "7", sampleOutput: "0 1 1 2 3 5 8",
    tests: [["7", "0 1 1 2 3 5 8"], ["1", "0"], ["2", "0 1", true], ["10", "0 1 1 2 3 5 8 13 21 34", true]],
    viva: [["What is the time complexity of the iterative method?", "O(n)."], ["Why is naive recursion slow?", "It recomputes the same subproblems, giving exponential time."], ["What is the ratio of consecutive terms approaching?", "The golden ratio, about 1.618."], ["How can memoization help?", "Storing computed terms makes recursion O(n)."], ["Which data type is needed for large terms?", "long long (or arbitrary precision beyond F(92))."]],
  },
  {
    n: 9, objectives: ["Test divisibility efficiently", "Use early loop termination"], cos: ["CO2"],
    theory: {
      introduction: "A prime number has exactly two distinct positive divisors: 1 and itself. Primality testing is fundamental in number theory and cryptography.",
      definition: "An integer n > 1 is prime if no integer d with 2 ≤ d ≤ √n divides n.",
      concepts: ["Modulus operator to test divisibility", "Checking only up to √n", "break to stop once a divisor is found"],
      working: "If n < 2 it is not prime. Otherwise test d = 2, 3, … while d × d ≤ n; if any d divides n, n is not prime.",
      applications: ["RSA key generation", "Hashing (prime table sizes)", "Number-theory problems"],
      examples: "29 is prime; 21 = 3 × 7 is not.",
    },
    problem: "Read an integer n and print \"Prime\" if it is prime, otherwise print \"Not Prime\".",
    algorithm: ["Start", "Read n", "If n < 2, print Not Prime and stop", "For d = 2 while d*d ≤ n: if n mod d = 0, print Not Prime and stop", "Print Prime", "Stop"],
    pseudocode: "READ n\nIF n < 2 THEN PRINT \"Not Prime\"; STOP\nd ← 2\nWHILE d × d ≤ n DO\n    IF n MOD d = 0 THEN PRINT \"Not Prime\"; STOP\n    d ← d + 1\nEND WHILE\nPRINT \"Prime\"",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n/]\n  B --> C{n < 2?}\n  C -- Yes --> N[/Not Prime/]\n  C -- No --> D[d = 2]\n  D --> E{d*d <= n?}\n  E -- No --> P[/Prime/]\n  E -- Yes --> F{n % d == 0?}\n  F -- Yes --> N\n  F -- No --> G[d = d + 1] --> E\n  N --> Z([Stop])\n  P --> Z",
    starter: "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    scanf(\"%lld\", &n);\n    // check primality\n    return 0;\n}\n",
    reference: "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    if (scanf(\"%lld\", &n) != 1) return 1;\n    int prime = n >= 2;\n    for (long long d = 2; prime && d * d <= n; d++)\n        if (n % d == 0) prime = 0;\n    puts(prime ? \"Prime\" : \"Not Prime\");\n    return 0;\n}\n",
    explanation: "If n has a divisor larger than √n it must also have one smaller than √n, so testing up to √n is sufficient. The loop condition d*d <= n avoids floating-point sqrt.",
    sampleInput: "29", sampleOutput: "Prime",
    tests: [["29", "Prime"], ["21", "Not Prime"], ["1", "Not Prime", true], ["2", "Prime", true], ["999983", "Prime", true], ["1000000", "Not Prime", true]],
    viva: [["Why test only up to √n?", "Divisors come in pairs; one of each pair is ≤ √n."], ["Is 1 prime?", "No, a prime needs exactly two distinct divisors."], ["What is the complexity?", "O(√n)."], ["Name a faster method for many numbers.", "The Sieve of Eratosthenes."], ["Why are primes important in cryptography?", "RSA security depends on the difficulty of factoring products of large primes."]],
  },
  {
    n: 10, objectives: ["Extract digits using / and %", "Rebuild a number in reverse"], cos: ["CO2"],
    theory: {
      introduction: "Digit manipulation using integer division and the modulus operator is a core programming skill. A palindrome number reads the same forwards and backwards.",
      definition: "A number is a palindrome if it equals its reverse, e.g. 12321.",
      concepts: ["n % 10 gives the last digit", "n / 10 removes the last digit", "rev = rev × 10 + digit builds the reverse"],
      working: "Copy n, then repeatedly take the last digit and append it to rev until the copy becomes 0. Compare rev with n.",
      applications: ["Checksum and digit-based validation", "Number puzzles", "Data validation"],
    },
    problem: "Read a non-negative integer n. Print its reverse on the first line, and on the second line print \"Palindrome\" or \"Not Palindrome\".",
    algorithm: ["Start", "Read n; set temp = n, rev = 0", "While temp > 0: rev = rev*10 + temp%10; temp = temp/10", "Print rev", "If rev = n print Palindrome else Not Palindrome", "Stop"],
    pseudocode: "READ n\ntemp ← n; rev ← 0\nWHILE temp > 0 DO\n    rev ← rev × 10 + temp MOD 10\n    temp ← temp DIV 10\nEND WHILE\nPRINT rev\nIF rev = n THEN PRINT \"Palindrome\" ELSE PRINT \"Not Palindrome\"",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n/]\n  B --> C[temp=n, rev=0]\n  C --> D{temp > 0?}\n  D -- Yes --> E[rev=rev*10+temp%10; temp=temp/10] --> D\n  D -- No --> F[/Print rev/]\n  F --> G{rev == n?}\n  G -- Yes --> H[/Palindrome/]\n  G -- No --> I[/Not Palindrome/]\n  H --> Z([Stop])\n  I --> Z",
    starter: "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    scanf(\"%lld\", &n);\n    return 0;\n}\n",
    reference: "#include <stdio.h>\n\nint main(void) {\n    long long n, temp, rev = 0;\n    if (scanf(\"%lld\", &n) != 1) return 1;\n    temp = n;\n    while (temp > 0) {\n        rev = rev * 10 + temp % 10;\n        temp /= 10;\n    }\n    printf(\"%lld\\n%s\\n\", rev, rev == n ? \"Palindrome\" : \"Not Palindrome\");\n    return 0;\n}\n",
    explanation: "The original value is preserved in n because the loop works on temp. For n = 0 the loop does not run and rev is 0, which is a palindrome.",
    sampleInput: "12321", sampleOutput: "12321\nPalindrome",
    tests: [["12321", "12321\nPalindrome"], ["1234", "4321\nNot Palindrome"], ["0", "0\nPalindrome", true], ["1200", "21\nNot Palindrome", true], ["9", "9\nPalindrome", true]],
    viva: [["What does n % 10 return?", "The last decimal digit of n."], ["Why copy n into temp?", "The loop destroys the value; we need the original for comparison."], ["How many iterations are needed?", "One per digit: O(log10 n)."], ["How would you handle negative numbers?", "Decide a rule (usually not palindromes) or work on the absolute value."], ["Can the reverse overflow?", "Yes, for values near the type's limit; checks can be added before multiplying."]],
  },
  {
    n: 18, objectives: ["Apply divide-and-conquer search", "Maintain loop invariants on low/high indices"], cos: ["CO3"],
    theory: {
      introduction: "Binary search finds an element in a sorted array by repeatedly halving the search interval. It is far faster than linear search for large data.",
      definition: "Given a sorted array A and key k, binary search compares k with the middle element and discards the half that cannot contain k.",
      concepts: ["Requires sorted data", "low, high and mid indices", "mid = low + (high − low)/2 avoids overflow", "Logarithmic time"],
      terminology: [["Invariant", "If k is present, it lies between low and high"], ["O(log n)", "Steps grow with the logarithm of the input size"]],
      working: "While low ≤ high, compute mid. If A[mid] equals k, return mid. If A[mid] < k, set low = mid + 1; else set high = mid − 1. If the loop ends, k is absent.",
      applications: ["Dictionary and index lookups", "Searching sorted records", "Finding boundaries in monotonic functions"],
    },
    problem: "Read n, then n integers in ascending order, then a key. Print the 1-based position of the key, or \"Not Found\". All elements are distinct.",
    algorithm: ["Start", "Read n, array A, key", "low = 0, high = n−1", "While low ≤ high: mid = (low+high)/2; if A[mid] = key print mid+1 and stop; else if A[mid] < key low = mid+1 else high = mid−1", "Print Not Found", "Stop"],
    pseudocode: "low ← 0; high ← n − 1\nWHILE low ≤ high DO\n    mid ← low + (high − low) DIV 2\n    IF A[mid] = key THEN RETURN mid\n    ELSE IF A[mid] < key THEN low ← mid + 1\n    ELSE high ← mid − 1\nEND WHILE\nRETURN NOT FOUND",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n, A, key/]\n  B --> C[low=0, high=n-1]\n  C --> D{low <= high?}\n  D -- No --> NF[/Not Found/]\n  D -- Yes --> E[mid=(low+high)/2]\n  E --> F{A[mid]==key?}\n  F -- Yes --> G[/Print mid+1/]\n  F -- No --> H{A[mid] < key?}\n  H -- Yes --> I[low=mid+1] --> D\n  H -- No --> J[high=mid-1] --> D\n  G --> Z([Stop])\n  NF --> Z",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int n, a[1000], key;\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\n    scanf(\"%d\", &key);\n    // binary search here\n    return 0;\n}\n",
    reference: "#include <stdio.h>\n\nint main(void) {\n    int n, a[1000], key;\n    if (scanf(\"%d\", &n) != 1) return 1;\n    for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\n    scanf(\"%d\", &key);\n    int low = 0, high = n - 1;\n    while (low <= high) {\n        int mid = low + (high - low) / 2;\n        if (a[mid] == key) { printf(\"%d\\n\", mid + 1); return 0; }\n        if (a[mid] < key) low = mid + 1; else high = mid - 1;\n    }\n    puts(\"Not Found\");\n    return 0;\n}\n",
    sampleInput: "6\n3 8 15 22 40 51\n22", sampleOutput: "4",
    tests: [["6\n3 8 15 22 40 51\n22", "4"], ["5\n1 2 3 4 5\n6", "Not Found"], ["1\n7\n7", "1", true], ["7\n-10 -3 0 4 9 12 30\n-10", "1", true], ["7\n-10 -3 0 4 9 12 30\n30", "7", true], ["4\n2 4 6 8\n5", "Not Found", true]],
    viva: [["What precondition does binary search need?", "The data must be sorted."], ["What is the worst-case complexity?", "O(log n)."], ["Why compute mid as low + (high−low)/2?", "To avoid integer overflow when low + high is large."], ["Compare with linear search.", "Linear is O(n) but works on unsorted data."], ["Can binary search work on a linked list efficiently?", "No; it needs O(1) random access."]],
  },
  {
    n: 19, objectives: ["Implement a comparison-based sort", "Trace passes and swaps"], cos: ["CO3"],
    theory: {
      introduction: "Bubble sort repeatedly steps through the array, compares adjacent elements and swaps them if they are in the wrong order. Larger elements 'bubble' to the end after each pass.",
      definition: "A stable, in-place sorting algorithm with O(n²) worst-case time.",
      concepts: ["Passes and adjacent comparisons", "Swapping with a temporary variable", "Early exit when a pass makes no swaps"],
      working: "For pass i from 0 to n−2, compare A[j] and A[j+1] for j from 0 to n−i−2 and swap if A[j] > A[j+1]. If a pass swaps nothing, the array is sorted.",
      applications: ["Teaching sorting concepts", "Nearly sorted small datasets"],
    },
    problem: "Read n and n integers. Sort them in ascending order using bubble sort and print them separated by spaces.",
    algorithm: ["Start", "Read n and A", "For i = 0 to n−2: swapped = false; for j = 0 to n−i−2: if A[j] > A[j+1], swap and set swapped = true; if not swapped break", "Print A", "Stop"],
    pseudocode: "FOR i ← 0 TO n − 2 DO\n    swapped ← FALSE\n    FOR j ← 0 TO n − i − 2 DO\n        IF A[j] > A[j+1] THEN SWAP(A[j], A[j+1]); swapped ← TRUE\n    END FOR\n    IF NOT swapped THEN BREAK\nEND FOR",
    flowchart: "flowchart TD\n  A([Start]) --> B[/Read n, A/]\n  B --> C[i = 0]\n  C --> D{i < n-1?}\n  D -- No --> P[/Print A/] --> Z([Stop])\n  D -- Yes --> E[j = 0, swapped = false]\n  E --> F{j < n-i-1?}\n  F -- Yes --> G{A[j] > A[j+1]?}\n  G -- Yes --> H[swap; swapped = true] --> I[j++] --> F\n  G -- No --> I\n  F -- No --> J{swapped?}\n  J -- No --> P\n  J -- Yes --> K[i++] --> D",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int n, a[1000];\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\n    // bubble sort\n    return 0;\n}\n",
    reference: "#include <stdio.h>\n\nint main(void) {\n    int n, a[1000];\n    if (scanf(\"%d\", &n) != 1) return 1;\n    for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\n    for (int i = 0; i < n - 1; i++) {\n        int swapped = 0;\n        for (int j = 0; j < n - i - 1; j++)\n            if (a[j] > a[j + 1]) { int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; swapped = 1; }\n        if (!swapped) break;\n    }\n    for (int i = 0; i < n; i++) printf(i ? \" %d\" : \"%d\", a[i]);\n    printf(\"\\n\");\n    return 0;\n}\n",
    sampleInput: "5\n64 25 12 22 11", sampleOutput: "11 12 22 25 64",
    tests: [["5\n64 25 12 22 11", "11 12 22 25 64"], ["3\n1 2 3", "1 2 3"], ["1\n42", "42", true], ["6\n5 -1 3 -1 0 2", "-1 -1 0 2 3 5", true], ["4\n9 8 7 6", "6 7 8 9", true]],
    viva: [["What is the best-case complexity with the swapped flag?", "O(n) for already sorted input."], ["Is bubble sort stable?", "Yes, equal elements are never swapped."], ["How many passes are needed at most?", "n − 1."], ["Is it in-place?", "Yes, O(1) extra space."], ["Why is it rarely used in practice?", "O(n²) comparisons make it slow for large inputs."]],
  },
];
