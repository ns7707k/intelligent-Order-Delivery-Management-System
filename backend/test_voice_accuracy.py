# Simulates confidence-threshold evaluation for voice command recognition.

test_cases = [
    # (simulated_confidence, expected_parse, description)
    (0.95, True, "Clear command: 'Order 5 Ready'"),
    (0.91, True, "Clear command: 'Order 12 Preparing'"),
    (0.85, True, "Acceptable: above 0.8 threshold"),
    (0.82, True, "Borderline pass: just above threshold"),
    (0.79, False, "Reject: below 0.8 threshold"),
    (0.65, False, "Reject: noisy environment simulation"),
    (0.55, False, "Reject: poor audio quality"),
    (0.90, True, "Clear command: 'Order 3 Delivered'"),
    (0.78, False, "Reject: ambient kitchen noise"),
    (0.88, True, "Clear: 'Order 7 Cancelled'"),
]

THRESHOLD = 0.8
correct = sum(1 for conf, expected, _ in test_cases if (conf >= THRESHOLD) == expected)

print(f"\n{'=' * 50}")
print("VOICE RECOGNITION EVALUATION")
print(f"{'=' * 50}")
print(f"Confidence Threshold: {THRESHOLD}")
print(f"Test cases: {len(test_cases)}")
print("")
for conf, expected, desc in test_cases:
    result = conf >= THRESHOLD
    status = "OK" if result == expected else "FAIL"
    action = "ACCEPT" if result else "REJECT"
    print(f"  {status} [{conf}] {action} - {desc}")

print("")
print(f"Recognition Accuracy   : {correct}/{len(test_cases)} ({correct / len(test_cases) * 100:.0f}%)")
print(
    "Threshold Effectiveness: "
    f"Correctly filtered {sum(1 for c, e, _ in test_cases if not e and c < THRESHOLD)} noisy inputs"
)
print(f"{'=' * 50}\n")
