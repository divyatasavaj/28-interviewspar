"""Curated explanations shown alongside submitted answers."""
from app.practice_topics import TOPICS

# Approach, common mistake, boundary case, and complexity of the described approach.
CODING_GUIDANCE = {
    "two-sum": ("Keep a map from seen values to indices. For each value, look up its complement before recording it.",
                "Inserting first can reuse the same index.", "Duplicate values and negative numbers.",
                "O(n) expected time and O(n) space."),
    "reverse-string": ("Read the characters in reverse order and join them once.",
                       "Repeated concatenation can copy the growing result.", "Empty and single-character input.",
                       "O(n) time and O(n) output space."),
    "fibonacci": ("Keep two adjacent Fibonacci numbers. Update the pair once per step, starting from zero and one.",
                  "Off-by-one iteration returns the next number.", "Check n = 0 and n = 1.",
                  "O(n) additions and O(1) stored numbers."),
    "fizzbuzz": ("Iterate from one to n. Test divisibility by both divisors first, then each individually.",
                 "Testing the single-divisor conditions first misses the combined case.", "Multiples of 15 and n = 1.",
                 "O(n) iterations and O(n) output entries."),
    "anagram": ("Count the occurrences of each character in both strings and compare the maps.",
                "A set loses repeated-character counts.", "Repeated characters, unequal lengths, and empty strings.",
                "O(n + m) expected time and O(k) space for k distinct characters."),
    "palindrome": ("Compare characters from opposite ends, moving inward after each match. Apply the prompt’s normalization rules before comparison.",
                   "Stopping before checking every mirrored pair can accept a mismatch.", "Empty, odd-length, and even-length inputs.",
                   "O(n) time and O(1) additional space for a two-pointer scan."),
    "frontend-classes": ("Trim each name, then append it only if it is nonempty and new to a set.",
                         "Sorting loses first-seen order.", "Whitespace-only entries and duplicates after trimming.",
                         "O(total characters) expected time and O(total characters) space including output."),
    "frontend-search": ("Lowercase the prefix once. Scan the names in order and append the original name on a prefix match. Stop at the limit.",
                        "Testing for a substring accepts matches in the middle.", "Zero limit, empty prefix, and mixed case.",
                        "O(total characters scanned) time and O(limit) output references."),
    "backend-rate": ("Move a right pointer through sorted times and advance the left pointer while the span is at least the window width. Track the largest remaining span in entries.",
                     "Using a strict greater-than test includes the excluded end.", "Equal timestamps and requests exactly one window apart.",
                     "O(n) time and O(1) auxiliary space."),
    "backend-cache": ("Keep keys in access order in an ordered map. On a hit, move the key to the newest end. On a full miss, remove the oldest key.",
                      "Refreshing order only on insertion implements FIFO.", "Zero capacity and repeated hits.",
                      "O(n) expected time and O(capacity) space with constant-time map operations."),
    "data-confusion": ("Visit each actual and predicted pair. Increment TP for 1/1, FP for 0/1, FN for 1/0, and TN for 0/0.",
                       "Swapping actual and predicted reverses FP and FN.", "Empty input and all-negative labels.",
                       "O(n) time and O(1) auxiliary space."),
    "data-window": ("Sum the first window, then add each incoming value and subtract the outgoing value.",
                     "Recomputing each window repeats work.", "Width one or wider than the list, and negative values.",
                     "O(n) time and O(1) auxiliary space excluding output."),
    "qa-ranges": ("Keep the next uncovered ID. Emit the gap before each covered ID and check for a final gap after the scan.",
                  "Exclusive end indices drop the last missing ID.", "No covered IDs, no gaps, and limit zero.",
                  "O(n) time and O(1) auxiliary space excluding output."),
    "qa-flaky": ("Track pass and fail flags per test in insertion order. Return names that have both flags.",
                 "Emitting when the second outcome occurs can change first-seen order.", "Repeated identical outcomes and interleaved test names.",
                 "O(n) expected time and O(k) space for k distinct test names."),
    "security-roles": ("Build sets of allowed and denied permissions. Scan requests in order, keeping each allowed, non-denied string once.",
                      "Checking allow without checking deny breaks precedence.", "Duplicates and a permission on both lists.",
                      "O(total entries) expected time and O(total distinct entries) space."),
    "security-locks": ("Track consecutive failures per user and a set of users already emitted. Reset that user’s count on success.",
                      "A single shared counter mixes different users.", "Threshold one, interleaved users, and repeat lockouts.",
                      "O(n) expected time and O(k) space for k users."),
    "common-merge": ("Sort by start. Extend the last merged interval when the new start is at most its end, otherwise append a new interval.",
                     "Replacing the end without taking the maximum shrinks nested intervals.", "Shared endpoints, nested intervals, and an empty list.",
                     "O(n log n) time and O(n) space for a sorted copy and output."),
    "common-count": ("Count occurrences in a map. Scan again and return the first string with count one.",
                     "First seen does not mean unique.", "The empty string can be the answer, and there may be no unique item.",
                     "O(n) expected time and O(k) space for k distinct strings."),
    "frontend-page": ("Multiply page by size, clamp the start to total, and clamp the exclusive end to total.",
                      "Treating page as one-based shifts every range.", "Empty data and pages past the final item.",
                      "O(1) time and space."),
    "data-missing": ("Scan each row and count only null values. Collect its index if the count reaches the threshold.",
                     "A truthiness check incorrectly counts zero as missing.", "Empty rows and unequal row lengths.",
                     "O(rows + cells) time and O(1) auxiliary space excluding output."),
    "qa-streak": ("Increment a running failure streak on false, reset on true, and update the maximum after each result.",
                  "Updating only at a success misses a trailing run.", "Empty input and all failures.",
                  "O(n) time and O(1) auxiliary space."),
    "security-mask": ("For length at most four, replace every character. Otherwise append the last four characters after a mask of length minus four.",
                      "Always preserving the last four exposes short tokens.", "Empty tokens and lengths four and five.",
                      "O(total characters) time and output space."),
    "backend-retries": ("Insert every request ID in a set and return its size.",
                        "Normalizing case can merge distinct IDs.", "Empty input and identical IDs at nonadjacent positions.",
                        "O(n) expected time and O(k) space for k distinct IDs."),
    "backend-cache-keys": ("Apply each event to a set of enabled keys. Add when enabled and discard when disabled. Return the set size.",
                           "Counting enabled events overcounts repeated updates.", "Disabling unseen keys and re-enabling after a disable.",
                           "O(n) expected time and O(k) space for k distinct keys."),
    "frontend-page-count": ("Divide total by size and round up. With integer arithmetic use quotient plus one only when there is a remainder.",
                            "Always adding one overcounts exact multiples.", "Zero total, exact multiples, and a final partial page.",
                            "O(1) time and space."),
    "data-model-errors": ("Compare actual and predicted labels at each index. Append the index when they differ.",
                          "Sorting labels breaks alignment between examples.", "No differences, all differences, and empty input.",
                          "O(n) time and O(1) auxiliary space excluding output."),
}

SPOKEN_EXAMPLES = {
    "rest-apis": "I’d send POST /orders with the items and quantities. The server validates stock, creates the order in a transaction, then returns 201 and the order ID. I’d accept an idempotency key so retrying a timed-out request can return the same order.",
    "sql": "I’d select customers for whom no order exists with the same customer ID, using NOT EXISTS. That avoids duplicate customer rows and the NULL trap of NOT IN. An index on orders.customer_id would help the lookup.",
    "javascript": "The synchronous handler finishes first. Promise callbacks run from the microtask queue before the browser takes another task, such as the timer callback. A zero delay means the timer becomes eligible, not that it interrupts the handler.",
    "react": "I’d keep the input value in state and derive the validation message from that value. I’d track whether the field has been touched separately so errors appear at the right time. That avoids storing a second copy of the validation result.",
    "accessibility": "I’d start with native controls, visible labels and focus indicators. I’d verify the tab order and let Enter submit. If validation fails, I’d associate errors with their fields and move focus to the first invalid field.",
    "data-structures-algorithms": "I’d scan once and put each seen value in a set. If it’s already there, I’ve found a duplicate. That’s expected O(n) time and O(n) space. If memory were tight and I could reorder the input, I’d sort and compare neighbors.",
    "python": "I’d iterate through the records and increment a counter for each field where the value is None, treating absent keys according to the schema. I’d test zero and empty strings separately because their truthiness doesn’t tell me whether they’re missing.",
    "machine-learning": "I’d start with precision and recall for the rare class. If missed positives are costly, I’d pick a threshold that meets a recall target, then check precision at that threshold on held-out data.",
    "system-design": "I’d measure how often requests look up the same data and where latency comes from. If repeat queries dominate and bounded staleness is acceptable, I’d test a cache with a TTL and measure hit rate and origin load.",
    "unit-testing": "I’d check a normal range, equal start and end, and an end before the start. I’d add invalid input cases and clarify whether the end is inclusive before writing tests for boundaries.",
    "ci-cd": "I’d run unit tests, a route integration test and a build. Then I’d smoke-test the deployed endpoint and monitor error rate and latency. A clear regression against the baseline would trigger the rollback procedure.",
    "application-security": "I’d test with two users and records owned by each. I’d confirm both can open their own records and get denied when substituting another user’s record ID. I’d repeat that check on list and update routes.",
}

BEHAVIORAL_EXAMPLE = (
    "On a team project we were going to miss a milestone after a dependency slipped. "
    "I listed the tasks that were blocked, checked priorities with the team, and moved the independent work forward. "
    "We delivered the core demo on time and agreed on a separate date for the remaining integration. "
    "I learned to check dependencies earlier when planning the next milestone."
)


def answer_guidance(question):
    problem = question.get("problem_id")
    if problem in CODING_GUIDANCE:
        return dict(zip(("approach", "mistake", "edge_cases", "complexity"), CODING_GUIDANCE[problem]))
    if question.get("evaluation_kind") == "behavioral":
        return {"approach": "Choose a real example. Explain the situation, your specific action, the result and what you learned.",
                "mistake": "Describing the team’s work without saying what you contributed.",
                "example": BEHAVIORAL_EXAMPLE, "example_label": "Example of an answer about a project setback"}
    topic = question.get("skill_topic")
    if topic in SPOKEN_EXAMPLES and (question.get("base_prompt") or question.get("prompt")) == TOPICS[topic][3][0]:
        return {"approach": "State the approach, explain why you chose it, and name a check or trade-off.",
                "mistake": "Giving a conclusion without showing the reasoning.",
                "example": SPOKEN_EXAMPLES[topic], "example_label": "Example spoken answer"}
    return {"approach": "Start with a direct answer. Explain your reasoning using a concrete example and describe how you would verify it.",
            "mistake": "Listing tools or terms without connecting them to the question.",
            "example": "One approach I’d consider is [approach], because [constraint]. I’d check it by [test or measurement]. If [boundary case] occurs, I’d [adjustment].",
            "example_label": "Spoken answer structure"}
