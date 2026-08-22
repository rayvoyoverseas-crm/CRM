import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Calculation() {
  const [country, setCountry] = useState("UK");

  const [exchangeRate, setExchangeRate] = useState("");
  const [loadingRate, setLoadingRate] = useState(false);

  const [tuitionFee, setTuitionFee] = useState("");

  const [location, setLocation] = useState("London");

  const [depositPaid, setDepositPaid] = useState("No");
  const [depositAmount, setDepositAmount] = useState("");

  const [scholarship, setScholarship] = useState("No");
  const [scholarshipAmount, setScholarshipAmount] = useState("");

  const [educationLoan, setEducationLoan] = useState("Not Required");
  const [loanAmountInr, setLoanAmountInr] = useState("");

  // Current UKVI Student visa maintenance requirement
  const livingExpenseGBP =
    location === "London"
      ? 1529 * 9
      : 1171 * 9;

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    try {
      setLoadingRate(true);

      const response = await fetch(
        "https://api.frankfurter.app/latest?from=GBP&to=INR"
      );

      const data = await response.json();

      if (data?.rates?.INR) {
        setExchangeRate(String(data.rates.INR));
      }
    } catch (error) {
      console.error("Unable to fetch GBP to INR rate", error);
    } finally {
      setLoadingRate(false);
    }
  };

  const numbers = useMemo(() => {
    const rate = Number(exchangeRate) || 0;
    const tuition = Number(tuitionFee) || 0;

    const deposit =
      depositPaid === "Yes"
        ? Number(depositAmount) || 0
        : 0;

    const scholarshipValue =
      scholarship === "Yes"
        ? Number(scholarshipAmount) || 0
        : 0;

    const outstandingTuition = Math.max(
      tuition - deposit - scholarshipValue,
      0
    );

    const totalRequiredGBP =
      outstandingTuition + livingExpenseGBP;

    const totalRequiredINR =
      totalRequiredGBP * rate;

    const tuitionINR =
      tuition * rate;

    const livingExpenseINR =
      livingExpenseGBP * rate;

    const outstandingTuitionINR =
      outstandingTuition * rate;

    const loanINR =
      educationLoan === "Taken" ||
      educationLoan === "Will Take"
        ? Number(loanAmountInr) || 0
        : 0;

    const loanGBP =
      rate > 0
        ? loanINR / rate
        : 0;

    const shortfallINR = Math.max(
      totalRequiredINR - loanINR,
      0
    );

    const shortfallGBP =
      rate > 0
        ? shortfallINR / rate
        : 0;

    const surplusINR = Math.max(
      loanINR - totalRequiredINR,
      0
    );

    const surplusGBP =
      rate > 0
        ? surplusINR / rate
        : 0;

    return {
      tuition,
      tuitionINR,
      deposit,
      scholarshipValue,
      outstandingTuition,
      outstandingTuitionINR,
      livingExpenseINR,
      totalRequiredGBP,
      totalRequiredINR,
      loanINR,
      loanGBP,
      shortfallINR,
      shortfallGBP,
      surplusINR,
      surplusGBP,
    };
  }, [
    exchangeRate,
    tuitionFee,
    depositPaid,
    depositAmount,
    scholarship,
    scholarshipAmount,
    educationLoan,
    loanAmountInr,
    livingExpenseGBP,
  ]);

  const formatGBP = (value) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(value || 0);

  const formatINR = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value || 0);

  return (
    <Layout
      title="Calculation"
      subtitle="Student financial requirement calculator"
    >
      <div className="space-y-6">

        {/* Calculator Form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-stone-900">
              Student Financial Calculator
            </h2>

            <p className="text-sm text-stone-500 mt-2">
              Calculate tuition fees, living expenses,
              scholarships, education loans and funding requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Country */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Country *
              </label>

              <Select
                value={country}
                onValueChange={setCountry}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="UK">
                    United Kingdom
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Exchange Rate */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                GBP to INR Exchange Rate *
              </label>

              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) =>
                    setExchangeRate(e.target.value)
                  }
                  placeholder="GBP → INR"
                />

                <button
                  type="button"
                  onClick={fetchExchangeRate}
                  disabled={loadingRate}
                  className="px-4 rounded-lg border border-stone-200 text-sm font-medium hover:bg-stone-50 whitespace-nowrap"
                >
                  {loadingRate ? "Loading..." : "Refresh Rate"}
                </button>
              </div>

              {exchangeRate && (
                <p className="text-xs text-stone-500 mt-2">
                  £1 = ₹{Number(exchangeRate).toFixed(2)}
                </p>
              )}
            </div>

            {/* Tuition */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Total Tuition Fee *
              </label>

              <Input
                type="number"
                min="0"
                value={tuitionFee}
                onChange={(e) =>
                  setTuitionFee(e.target.value)
                }
                placeholder="Enter tuition fee in GBP"
                className="mt-2"
              />

              {tuitionFee && exchangeRate && (
                <p className="text-xs text-stone-500 mt-2">
                  {formatINR(numbers.tuitionINR)}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Study Location *
              </label>

              <Select
                value={location}
                onValueChange={setLocation}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="London">
                    Inside London
                  </SelectItem>

                  <SelectItem value="Outside London">
                    Outside London
                  </SelectItem>
                </SelectContent>
              </Select>

              <p className="text-xs text-stone-500 mt-2">
                UKVI living requirement:{" "}
                {formatGBP(livingExpenseGBP)}
              </p>
            </div>

            {/* Deposit */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Tuition Deposit Paid *
              </label>

              <Select
                value={depositPaid}
                onValueChange={(value) => {
                  setDepositPaid(value);

                  if (value === "No") {
                    setDepositAmount("");
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {depositPaid === "Yes" && (
              <div>
                <label className="text-sm font-medium text-stone-700">
                  Tuition Deposit Amount *
                </label>

                <Input
                  type="number"
                  min="0"
                  value={depositAmount}
                  onChange={(e) =>
                    setDepositAmount(e.target.value)
                  }
                  placeholder="Deposit paid in GBP"
                  className="mt-2"
                />
              </div>
            )}

            {/* Scholarship */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Scholarship *
              </label>

              <Select
                value={scholarship}
                onValueChange={(value) => {
                  setScholarship(value);

                  if (value === "No") {
                    setScholarshipAmount("");
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scholarship === "Yes" && (
              <div>
                <label className="text-sm font-medium text-stone-700">
                  Scholarship Amount *
                </label>

                <Input
                  type="number"
                  min="0"
                  value={scholarshipAmount}
                  onChange={(e) =>
                    setScholarshipAmount(e.target.value)
                  }
                  placeholder="Scholarship in GBP"
                  className="mt-2"
                />
              </div>
            )}

            {/* Education Loan */}
            <div>
              <label className="text-sm font-medium text-stone-700">
                Education Loan *
              </label>

              <Select
                value={educationLoan}
                onValueChange={(value) => {
                  setEducationLoan(value);

                  if (value === "Not Required") {
                    setLoanAmountInr("");
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Will Take">
                    Will Take
                  </SelectItem>

                  <SelectItem value="Taken">
                    Taken
                  </SelectItem>

                  <SelectItem value="Not Required">
                    Not Required
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(educationLoan === "Taken" ||
              educationLoan === "Will Take") && (
              <div>
                <label className="text-sm font-medium text-stone-700">
                  Education Loan Amount in INR *
                </label>

                <Input
                  type="number"
                  min="0"
                  value={loanAmountInr}
                  onChange={(e) =>
                    setLoanAmountInr(e.target.value)
                  }
                  placeholder="Loan amount in INR"
                  className="mt-2"
                />

                {loanAmountInr && exchangeRate && (
                  <p className="text-xs text-stone-500 mt-2">
                    Approx. {formatGBP(numbers.loanGBP)}
                  </p>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Summary */}
        {tuitionFee && exchangeRate && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">

            <h2 className="text-xl font-semibold text-stone-900 mb-5">
              Financial Requirement Summary
            </h2>

            <div className="space-y-3">

              <div className="flex justify-between border-b pb-3">
                <span className="text-stone-500">
                  Total Tuition Fee
                </span>

                <div className="text-right font-semibold">
                  <div>
                    {formatGBP(numbers.tuition)}
                  </div>

                  <div className="text-xs text-stone-500">
                    {formatINR(numbers.tuitionINR)}
                  </div>
                </div>
              </div>

              {numbers.deposit > 0 && (
                <div className="flex justify-between border-b pb-3">
                  <span className="text-stone-500">
                    Tuition Deposit Paid
                  </span>

                  <span className="font-semibold text-green-700">
                    - {formatGBP(numbers.deposit)}
                  </span>
                </div>
              )}

              {numbers.scholarshipValue > 0 && (
                <div className="flex justify-between border-b pb-3">
                  <span className="text-stone-500">
                    Scholarship
                  </span>

                  <span className="font-semibold text-green-700">
                    - {formatGBP(numbers.scholarshipValue)}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-b pb-3">
                <span className="text-stone-500">
                  Outstanding Tuition
                </span>

                <div className="text-right font-semibold">
                  <div>
                    {formatGBP(numbers.outstandingTuition)}
                  </div>

                  <div className="text-xs text-stone-500">
                    {formatINR(
                      numbers.outstandingTuitionINR
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between border-b pb-3">
                <div>
                  <div className="text-stone-500">
                    UKVI Living Expense
                  </div>

                  <div className="text-xs text-stone-400">
                    {location === "London"
                      ? "Inside London · £1,529 × 9 months"
                      : "Outside London · £1,171 × 9 months"}
                  </div>
                </div>

                <div className="text-right font-semibold">
                  <div>
                    {formatGBP(livingExpenseGBP)}
                  </div>

                  <div className="text-xs text-stone-500">
                    {formatINR(
                      numbers.livingExpenseINR
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-base font-bold text-stone-900">
                  Total Funds Required
                </span>

                <div className="text-right">
                  <div className="text-xl font-bold text-[#1B365D]">
                    {formatGBP(
                      numbers.totalRequiredGBP
                    )}
                  </div>

                  <div className="font-semibold text-stone-600">
                    {formatINR(
                      numbers.totalRequiredINR
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Loan status */}
            {(educationLoan === "Taken" ||
              educationLoan === "Will Take") &&
              numbers.loanINR > 0 && (
                <div className="mt-6">

                  <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 mb-4">
                    <div className="text-xs uppercase tracking-wider text-stone-500">
                      Education Loan
                    </div>

                    <div className="font-semibold text-lg mt-1">
                      {formatINR(numbers.loanINR)}
                    </div>

                    <div className="text-sm text-stone-500">
                      Approx. {formatGBP(numbers.loanGBP)}
                    </div>
                  </div>

                  {numbers.shortfallINR > 0 ? (
                    <div className="border border-red-200 bg-red-50 rounded-xl p-5">
                      <div className="text-red-700 font-bold">
                        Funding Shortfall
                      </div>

                      <div className="text-2xl font-bold text-red-700 mt-2">
                        {formatINR(numbers.shortfallINR)}
                      </div>

                      <div className="text-sm text-red-600 mt-1">
                        {formatGBP(numbers.shortfallGBP)}
                      </div>

                      <p className="text-sm text-red-700 mt-4">
                        Additional qualifying funds are required
                        to meet the calculated financial requirement.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                      <div className="text-green-700 font-bold">
                        Good to Go
                      </div>

                      <p className="text-sm text-green-700 mt-2">
                        The education loan meets or exceeds
                        the calculated financial requirement.
                      </p>

                      {numbers.surplusINR > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-green-700">
                            Additional Coverage
                          </div>

                          <div className="font-semibold text-green-800">
                            {formatINR(numbers.surplusINR)}
                            {" · "}
                            {formatGBP(numbers.surplusGBP)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            {/* No Loan */}
            {educationLoan === "Not Required" && (
              <div className="mt-6 border border-amber-200 bg-amber-50 rounded-xl p-5">
                <div className="font-bold text-amber-800">
                  Personal / Eligible Funds Required
                </div>

                <div className="text-2xl font-bold text-amber-800 mt-2">
                  {formatINR(numbers.totalRequiredINR)}
                </div>

                <div className="text-sm text-amber-700 mt-1">
                  {formatGBP(numbers.totalRequiredGBP)}
                </div>

                <p className="text-sm text-amber-800 mt-4">
                  The student must demonstrate eligible funds
                  according to the applicable UKVI financial
                  evidence requirements.
                </p>
              </div>
            )}

          </div>
        )}

      </div>
    </Layout>
  );
}
