#!/bin/bash
# run_load_tests.sh
# Runs all three k6 load test scenarios sequentially and saves results to JSON.
#
# Usage:
#   chmod +x tests/load/run_load_tests.sh
#   ./tests/load/run_load_tests.sh
#   ./tests/load/run_load_tests.sh http://13.60.227.214   # against the deployed server

set -e  # exit immediately if any command fails

BASE_URL="${1:-https://yovi.13.63.89.84.sslip.io/api}"
RESULTS_DIR="tests/load/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "============================================"
echo "  Yovi Load Tests"
echo "  Target: $BASE_URL"
echo "  Results: $RESULTS_DIR"
echo "============================================"

mkdir -p "$RESULTS_DIR"

run_test() {
  local name="$1"
  local script="$2"
  local json_output="$RESULTS_DIR/${name}_${TIMESTAMP}.json"
  local log_output="$RESULTS_DIR/${name}_${TIMESTAMP}.txt"

  echo ""
  echo "▶  Running : $name"
  echo "   Script  : $script"
  echo "   JSON    : $json_output"
  echo "   Log     : $log_output"
  echo "--------------------------------------------"

  k6 run \
    --out "json=$json_output" \
    -e BASE_URL="$BASE_URL" \
    "$script" 2>&1 | tee "$log_output"

  echo "✔  $name finished"
}

run_test "register"   "tests/load/register.js"
run_test "login"      "tests/load/login.js"
run_test "start_game" "tests/load/start_game.js"

echo ""
echo "============================================"
echo "  All tests completed."
echo "  Results saved in: $RESULTS_DIR"
echo "============================================"
