import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  IndianRupee,
  Calculator,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CURRENCIES = ["INR", "GBP", "EUR", "USD"];

const CURRENCY_SYMBOLS = {
  INR: "₹",
  GBP: "£",
  EUR: "€",
  USD: "$",
};

const emptyMoneySection = {
  enabled: false,
  currency: "INR",
  exchange_rate: 1,
  received_amount: "",
};

const initialRevenue = {
  university: {
    ...emptyMoneySection,
    university_name: "",
    tuition_fee: "",
    scholarship: "no",
    scholarship_amount: "",
    commission_percent: "",
  },

  education_loan: {
    ...emptyMoneySection,
    organisation: "",
    loan_amount: "",
    commission_percent: "",
  },

  accommodation: {
    ...emptyMoneySection,
    organisation: "",
    booking_amount: "",
    commission_percent: "",
  },

  ielts: {
    ...emptyMoneySection,
    total_taken: "",
    actual_cost: "",
  },

  tuition_fee_profit: {
    ...emptyMoneySection,
    amount_payable: "",
    total_taken: "",
  },

  visa_fee_profit: {
    ...emptyMoneySection,
    amount_payable: "",
    total_taken: "",
  },

  service_package: {
    ...emptyMoneySection,
    package_type: "",
    package_name: "",
    package_fee: "",
  },
};

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getRate(section) {
  if (section.currency === "INR") {
    return 1;
  }

  return numberValue(section.exchange_rate);
}

function formatMoney(amount, currency = "INR") {
  const value = numberValue(amount);

  return `${CURRENCY_SYMBOLS[currency] || ""}${value.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function SectionToggle({
  title,
  enabled,
  onChange,
  children,
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5 border-b border-stone-100">
        <div>
          <h3 className="font-display font-semibold text-stone-900">
            {title}
          </h3>

          <p className="text-xs text-stone-500 mt-1">
            Include this revenue source for the selected student.
          </p>
        </div>

        <div className="flex bg-stone-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-4 py-2 text-sm rounded-lg transition ${
              enabled
                ? "bg-[#1B365D] text-white shadow-sm"
                : "text-stone-500"
            }`}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-4 py-2 text-sm rounded-lg transition ${
              !enabled
                ? "bg-white text-stone-800 shadow-sm"
                : "text-stone-500"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {enabled && (
        <div className="p-5">
          {children}
        </div>
      )}
    </div>
  );
}

function CurrencyFields({
  data,
  update,
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Currency
        </label>

        <select
          value={data.currency}
          onChange={(e) => {
            const currency = e.target.value;

            update(
              "currency",
              currency
            );

            if (currency === "INR") {
              update(
                "exchange_rate",
                1
              );
            }
          }}
          className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
        >
          {CURRENCIES.map((currency) => (
            <option
              key={currency}
              value={currency}
            >
              {currency} ({CURRENCY_SYMBOLS[currency]})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Exchange Rate to INR
        </label>

        <input
          type="number"
          step="0.01"
          min="0"
          value={data.exchange_rate}
          disabled={
            data.currency === "INR"
          }
          onChange={(e) =>
            update(
              "exchange_rate",
              e.target.value
            )
          }
          className="w-full h-11 px-3 rounded-xl border border-stone-200 disabled:bg-stone-100"
          placeholder="Example: 130.51"
        />

        {data.currency !== "INR" && (
          <div className="text-[11px] text-stone-400 mt-1">
            1 {data.currency} = ₹
            {numberValue(
              data.exchange_rate
            ).toLocaleString("en-IN")}
          </div>
        )}
      </div>
    </>
  );
}

function ReceivedField({
  data,
  update,
}) {
  const rate = getRate(data);

  const received =
    numberValue(
      data.received_amount
    );

  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">
        Amount Received
      </label>

      <input
        type="number"
        step="0.01"
        min="0"
        value={data.received_amount}
        onChange={(e) =>
          update(
            "received_amount",
            e.target.value
          )
        }
        className="w-full h-11 px-3 rounded-xl border border-stone-200"
        placeholder={`Amount received in ${data.currency}`}
      />

      <div className="text-[11px] text-stone-400 mt-1">
        INR:{" "}
        {formatMoney(
          received * rate,
          "INR"
        )}
      </div>
    </div>
  );
}

function AmountConversion({
  label,
  amount,
  currency,
  rate,
}) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
        {label}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="text-xs text-stone-500">
            {currency}
          </div>

          <div className="font-semibold text-stone-900 text-lg">
            {formatMoney(
              amount,
              currency
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            INR Equivalent
          </div>

          <div className="font-semibold text-stone-900 text-lg">
            {formatMoney(
              amount * rate,
              "INR"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueResult({
  label,
  amount,
  received,
  currency,
  rate,
}) {
  const outstanding =
    Math.max(
      0,
      amount - received
    );

  return (
    <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
        {label}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        <div>
          <div className="text-xs text-stone-500">
            Calculated
          </div>

          <div className="font-semibold text-stone-900 mt-1">
            {formatMoney(
              amount,
              currency
            )}
          </div>

          <div className="text-xs text-stone-500 mt-1">
            {formatMoney(
              amount * rate,
              "INR"
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            Received
          </div>

          <div className="font-semibold text-emerald-700 mt-1">
            {formatMoney(
              received,
              currency
            )}
          </div>

          <div className="text-xs text-stone-500 mt-1">
            {formatMoney(
              received * rate,
              "INR"
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            Outstanding
          </div>

          <div className="font-semibold text-[#C05B43] mt-1">
            {formatMoney(
              outstanding,
              currency
            )}
          </div>

          <div className="text-xs text-[#C05B43] mt-1">
            {formatMoney(
              outstanding * rate,
              "INR"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Revenue() {
  const { user } = useAuth();

  const [students, setStudents] =
    useState([]);

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState("");

  const [revenue, setRevenue] =
    useState(initialRevenue);

  const [
    loadingStudents,
    setLoadingStudents,
  ] = useState(true);

  const [
  loadingRevenue,
  setLoadingRevenue,
] = useState(false);

const [
  savingRevenue,
  setSavingRevenue,
] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    const loadStudents =
      async () => {
        try {
          setLoadingStudents(
            true
          );

          const { data } =
            await api.get(
              "/leads",
              {
                params: {
                  pipeline:
                    "study_abroad",
                },
              }
            );

          setStudents(
            Array.isArray(data)
              ? data
              : []
          );
        } catch (error) {
          console.error(
            "Unable to load students",
            error
          );
        } finally {
          setLoadingStudents(
            false
          );
        }
      };

    loadStudents();
  }, [user?.role]);

  useEffect(() => {
  if (
    user?.role !== "admin" ||
    !selectedStudent
  ) {
    return;
  }

  const loadSavedRevenue =
    async () => {
      try {
        setLoadingRevenue(true);

        const { data } =
          await api.get(
            `/revenue/${selectedStudent}`
          );

        if (
          data?.exists &&
          data?.revenue
        ) {
          setRevenue(
            data.revenue
          );
        } else {
          setRevenue(
            initialRevenue
          );
        }
      } catch (error) {
        console.error(
          "Unable to load saved revenue",
          error
        );

        setRevenue(
          initialRevenue
        );
      } finally {
        setLoadingRevenue(false);
      }
    };

  loadSavedRevenue();
}, [
  selectedStudent,
  user?.role,
]);

  const updateSection = (
    section,
    field,
    value
  ) => {
    setRevenue((previous) => ({
      ...previous,

      [section]: {
        ...previous[section],
        [field]: value,
      },
    }));
  };

  const toggleSection = (
    section,
    enabled
  ) => {
    setRevenue((previous) => ({
      ...previous,

      [section]: {
        ...previous[section],
        enabled,
      },
    }));
  };

  const calculations =
    useMemo(() => {
      const university =
        revenue.university;

      const universityRate =
        getRate(university);

      const grossTuition =
        university.enabled
          ? numberValue(
              university.tuition_fee
            )
          : 0;

      const scholarship =
        university.enabled &&
        university.scholarship ===
          "yes"
          ? numberValue(
              university.scholarship_amount
            )
          : 0;

      const netTuition =
        Math.max(
          0,
          grossTuition -
            scholarship
        );

      const universityCommission =
        netTuition *
        (
          numberValue(
            university.commission_percent
          ) / 100
        );

      const universityReceived =
        numberValue(
          university.received_amount
        );

      const percentageCalculation = (
        section,
        baseField
      ) => {
        if (!section.enabled) {
          return {
            amount: 0,
            received: 0,
            rate: getRate(section),
          };
        }

        const base =
          numberValue(
            section[baseField]
          );

        const percentage =
          numberValue(
            section.commission_percent
          );

        return {
          amount:
            base *
            (percentage / 100),

          received:
            numberValue(
              section.received_amount
            ),

          rate:
            getRate(section),
        };
      };

      const profitCalculation = (
        section,
        payableField
      ) => {
        if (!section.enabled) {
          return {
            amount: 0,
            received: 0,
            rate: getRate(section),
          };
        }

        const totalTaken =
          numberValue(
            section.total_taken
          );

        const payable =
          numberValue(
            section[
              payableField
            ]
          );

        return {
          amount:
            Math.max(
              0,
              totalTaken -
                payable
            ),

          received:
            numberValue(
              section.received_amount
            ),

          rate:
            getRate(section),
        };
      };

      const educationLoan =
        percentageCalculation(
          revenue.education_loan,
          "loan_amount"
        );

      const accommodation =
        percentageCalculation(
          revenue.accommodation,
          "booking_amount"
        );

      const ielts =
        profitCalculation(
          revenue.ielts,
          "actual_cost"
        );

      const tuitionFeeProfit =
        profitCalculation(
          revenue.tuition_fee_profit,
          "amount_payable"
        );

      const visaFeeProfit =
        profitCalculation(
          revenue.visa_fee_profit,
          "amount_payable"
        );

      const serviceRate =
        getRate(
          revenue.service_package
        );

      const servicePackage = {
        amount:
          revenue.service_package
            .enabled
            ? numberValue(
                revenue
                  .service_package
                  .package_fee
              )
            : 0,

        received:
          revenue.service_package
            .enabled
            ? numberValue(
                revenue
                  .service_package
                  .received_amount
              )
            : 0,

        rate: serviceRate,
      };

      const universityResult = {
        amount:
          universityCommission,

        received:
          universityReceived,

        rate:
          universityRate,
      };

      const allResults = [
        universityResult,
        educationLoan,
        accommodation,
        ielts,
        tuitionFeeProfit,
        visaFeeProfit,
        servicePackage,
      ];

      const expectedInr =
        allResults.reduce(
          (sum, item) =>
            sum +
            item.amount *
              item.rate,
          0
        );

      const receivedInr =
        allResults.reduce(
          (sum, item) =>
            sum +
            item.received *
              item.rate,
          0
        );

      return {
        grossTuition,
        scholarship,
        netTuition,

        university:
          universityResult,

        educationLoan,
        accommodation,
        ielts,
        tuitionFeeProfit,
        visaFeeProfit,
        servicePackage,

        expectedInr,

        receivedInr,

        balanceInr:
          Math.max(
            0,
            expectedInr -
              receivedInr
          ),
      };
    }, [revenue]);

const saveRevenue =
  async () => {
    if (!selectedStudent) {
      alert(
        "Please select a student first."
      );
      return;
    }

    try {
      setSavingRevenue(true);

      await api.post(
        `/revenue/${selectedStudent}`,
        {
          revenue,

          totals: {
            expected_inr:
              calculations.expectedInr,

            received_inr:
              calculations.receivedInr,

            balance_inr:
              calculations.balanceInr,
          },
        }
      );

      alert(
        "Revenue saved successfully."
      );
    } catch (error) {
      console.error(
        "Unable to save revenue",
        error
      );

      alert(
        error?.response?.data?.detail ||
          "Unable to save revenue."
      );
    } finally {
      setSavingRevenue(false);
    }
  };

  if (
    user &&
    user.role !== "admin"
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  const selectedStudentData =
    students.find(
      (student) =>
        student.id ===
        selectedStudent
    );

  return (
    <Layout
      title="Revenue"
      subtitle="Track commissions, profits, service charges and outstanding revenue."
    >
      <div className="space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            label="Expected Revenue"
            amount={
              calculations.expectedInr
            }
          />

          <SummaryCard
            label="Received"
            amount={
              calculations.receivedInr
            }
            variant="received"
          />

          <SummaryCard
            label="Outstanding"
            amount={
              calculations.balanceInr
            }
            variant="outstanding"
          />
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-5 h-5 text-[#C05B43]" />

            <h2 className="font-display font-semibold text-lg">
              Student Revenue
            </h2>
          </div>

          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Select Student
          </label>
          
          <select
            value={selectedStudent}
            onChange={(e) => {
              const studentId = e.target.value;
          
              setSelectedStudent(studentId);
          
              setRevenue(initialRevenue);
            }}
            className="w-full max-w-xl h-12 px-3 rounded-xl border border-stone-200 bg-white"
          >
            <option value="">
              {loadingStudents
                ? "Loading students..."
                : "Select a student"}
            </option>

            {students.map(
              (student) => (
                <option
                  key={
                    student.id
                  }
                  value={
                    student.id
                  }
                >
                  {student.name}
                  {student.email
                    ? ` · ${student.email}`
                    : ""}
                </option>
              )
            )}
          </select>

      {selectedStudentData && (
        <div className="mt-3 text-sm text-stone-500">
          {loadingRevenue
            ? "Loading saved revenue..."
            : (
              <>
                Revenue record for{" "}
                <strong className="text-stone-800">
                  {
                    selectedStudentData.name
                  }
                </strong>
              </>
            )}
        </div>
      )}
        </div>

        {!selectedStudent ? (
          <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-10 text-center">
            <Calculator className="w-8 h-8 mx-auto text-stone-300 mb-3" />

            <div className="font-medium text-stone-700">
              Select a student first
            </div>
          </div>
        ) : (
          <>
            <UniversitySection
              revenue={revenue}
              calculations={
                calculations
              }
              updateSection={
                updateSection
              }
              toggleSection={
                toggleSection
              }
            />

            <SectionToggle
              title="Education Loan"
              enabled={
                revenue
                  .education_loan
                  .enabled
              }
              onChange={(
                enabled
              ) =>
                toggleSection(
                  "education_loan",
                  enabled
                )
              }
            >
              <PercentageSection
                data={
                  revenue.education_loan
                }
                update={(
                  field,
                  value
                ) =>
                  updateSection(
                    "education_loan",
                    field,
                    value
                  )
                }
                organisationLabel="Loan Organisation"
                amountLabel="Loan Amount"
                amountField="loan_amount"
                result={
                  calculations.educationLoan
                }
              />
            </SectionToggle>

            <SectionToggle
              title="Accommodation"
              enabled={
                revenue
                  .accommodation
                  .enabled
              }
              onChange={(
                enabled
              ) =>
                toggleSection(
                  "accommodation",
                  enabled
                )
              }
            >
              <PercentageSection
                data={
                  revenue.accommodation
                }
                update={(
                  field,
                  value
                ) =>
                  updateSection(
                    "accommodation",
                    field,
                    value
                  )
                }
                organisationLabel="Accommodation Organisation"
                amountLabel="Accommodation / Booking Amount"
                amountField="booking_amount"
                result={
                  calculations.accommodation
                }
              />
            </SectionToggle>

            <SectionToggle
              title="IELTS"
              enabled={
                revenue.ielts
                  .enabled
              }
              onChange={(
                enabled
              ) =>
                toggleSection(
                  "ielts",
                  enabled
                )
              }
            >
              <ProfitSection
                data={
                  revenue.ielts
                }
                update={(
                  field,
                  value
                ) =>
                  updateSection(
                    "ielts",
                    field,
                    value
                  )
                }
                payableLabel="Actual IELTS Cost"
                payableField="actual_cost"
                result={
                  calculations.ielts
                }
              />
            </SectionToggle>

            <SectionToggle
              title="Tuition Fee Profit"
              enabled={
                revenue
                  .tuition_fee_profit
                  .enabled
              }
              onChange={(
                enabled
              ) =>
                toggleSection(
                  "tuition_fee_profit",
                  enabled
                )
              }
            >
              <ProfitSection
                data={
                  revenue
                    .tuition_fee_profit
                }
                update={(
                  field,
                  value
                ) =>
                  updateSection(
                    "tuition_fee_profit",
                    field,
                    value
                  )
                }
                payableLabel="Tuition Fee Need to Pay University"
                payableField="amount_payable"
                result={
                  calculations
                    .tuitionFeeProfit
                }
              />
            </SectionToggle>

            <SectionToggle
              title="Visa Fee Profit"
              enabled={
                revenue
                  .visa_fee_profit
                  .enabled
              }
              onChange={(
                enabled
              ) =>
                toggleSection(
                  "visa_fee_profit",
                  enabled
                )
              }
            >
              <ProfitSection
                data={
                  revenue
                    .visa_fee_profit
                }
                update={(
                  field,
                  value
                ) =>
                  updateSection(
                    "visa_fee_profit",
                    field,
                    value
                  )
                }
                payableLabel="Visa Fee Need to Pay"
                payableField="amount_payable"
                result={
                  calculations
                    .visaFeeProfit
                }
              />
            </SectionToggle>

            <ServicePackageSection
              revenue={revenue}
              result={
                calculations
                  .servicePackage
              }
              updateSection={
                updateSection
              }
              toggleSection={
                toggleSection
              }
            />

            <div className="bg-[#1B365D] text-white rounded-2xl p-6">
              <div className="text-sm text-white/70">
                Student Revenue Summary
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                <DarkTotal
                  label="Expected"
                  amount={
                    calculations.expectedInr
                  }
                />

                <DarkTotal
                  label="Received"
                  amount={
                    calculations.receivedInr
                  }
                />

                <DarkTotal
                  label="Balance"
                  amount={
                    calculations.balanceInr
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
            <Button
              type="button"
              onClick={saveRevenue}
              disabled={
                savingRevenue ||
                loadingRevenue
              }
              className="bg-[#C05B43] hover:bg-[#a94e39] rounded-xl px-6"
            >
              <Save className="w-4 h-4 mr-2" />
            
              {savingRevenue
                ? "Saving..."
                : "Save Revenue"}
            </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function UniversitySection({
  revenue,
  calculations,
  updateSection,
  toggleSection,
}) {
  const data =
    revenue.university;

  const rate =
    getRate(data);

  return (
    <SectionToggle
      title="University Commission"
      enabled={data.enabled}
      onChange={(enabled) =>
        toggleSection(
          "university",
          enabled
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label className="block text-sm font-medium mb-1.5">
            University Name
          </label>

          <input
            value={
              data.university_name
            }
            onChange={(e) =>
              updateSection(
                "university",
                "university_name",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
            placeholder="University name"
          />
        </div>

        <CurrencyFields
          data={data}
          update={(
            field,
            value
          ) =>
            updateSection(
              "university",
              field,
              value
            )
          }
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Total Tuition Fees
          </label>

          <input
            type="number"
            value={
              data.tuition_fee
            }
            onChange={(e) =>
              updateSection(
                "university",
                "tuition_fee",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Scholarship
          </label>

          <select
            value={
              data.scholarship
            }
            onChange={(e) =>
              updateSection(
                "university",
                "scholarship",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
          >
            <option value="no">
              No
            </option>

            <option value="yes">
              Yes
            </option>
          </select>
        </div>

        {data.scholarship ===
          "yes" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Scholarship Amount
            </label>

            <input
              type="number"
              value={
                data.scholarship_amount
              }
              onChange={(e) =>
                updateSection(
                  "university",
                  "scholarship_amount",
                  e.target.value
                )
              }
              className="w-full h-11 px-3 rounded-xl border border-stone-200"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Commission %
          </label>

          <input
            type="number"
            step="0.01"
            value={
              data.commission_percent
            }
            onChange={(e) =>
              updateSection(
                "university",
                "commission_percent",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <ReceivedField
          data={data}
          update={(
            field,
            value
          ) =>
            updateSection(
              "university",
              field,
              value
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
        <AmountConversion
          label="Original Tuition Fee"
          amount={
            calculations.grossTuition
          }
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Scholarship"
          amount={
            calculations.scholarship
          }
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Tuition After Scholarship"
          amount={
            calculations.netTuition
          }
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Calculated University Commission"
        amount={
          calculations
            .university
            .amount
        }
        received={
          calculations
            .university
            .received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </SectionToggle>
  );
}

function PercentageSection({
  data,
  update,
  organisationLabel,
  amountLabel,
  amountField,
  result,
}) {
  const rate =
    getRate(data);

  const baseAmount =
    numberValue(
      data[amountField]
    );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {organisationLabel}
          </label>

          <input
            value={
              data.organisation
            }
            onChange={(e) =>
              update(
                "organisation",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
            placeholder="Organisation"
          />
        </div>

        <CurrencyFields
          data={data}
          update={update}
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">
            {amountLabel}
          </label>

          <input
            type="number"
            value={
              data[amountField]
            }
            onChange={(e) =>
              update(
                amountField,
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Commission %
          </label>

          <input
            type="number"
            step="0.01"
            value={
              data.commission_percent
            }
            onChange={(e) =>
              update(
                "commission_percent",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="mt-5">
        <AmountConversion
          label={amountLabel}
          amount={baseAmount}
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Calculated Commission"
        amount={result.amount}
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}

function ProfitSection({
  data,
  update,
  payableLabel,
  payableField,
  result,
}) {
  const rate =
    getRate(data);

  const payable =
    numberValue(
      data[payableField]
    );

  const totalTaken =
    numberValue(
      data.total_taken
    );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CurrencyFields
          data={data}
          update={update}
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">
            {payableLabel}
          </label>

          <input
            type="number"
            value={
              data[payableField]
            }
            onChange={(e) =>
              update(
                payableField,
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Total Amount Taken
          </label>

          <input
            type="number"
            value={
              data.total_taken
            }
            onChange={(e) =>
              update(
                "total_taken",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <ReceivedField
          data={data}
          update={update}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
        <AmountConversion
          label={payableLabel}
          amount={payable}
          currency={
            data.currency
          }
          rate={rate}
        />

        <AmountConversion
          label="Total Amount Taken"
          amount={
            totalTaken
          }
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Calculated Profit"
        amount={result.amount}
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </>
  );
}

function ServicePackageSection({
  revenue,
  result,
  updateSection,
  toggleSection,
}) {
  const data =
    revenue.service_package;

  const rate =
    getRate(data);

  return (
    <SectionToggle
      title="Rayvoy Service Package"
      enabled={data.enabled}
      onChange={(enabled) =>
        toggleSection(
          "service_package",
          enabled
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Package Type
          </label>

          <select
            value={
              data.package_type
            }
            onChange={(e) =>
              updateSection(
                "service_package",
                "package_type",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
          >
            <option value="">
              Select package
            </option>

            <option value="germany">
              Germany
            </option>

            <option value="top_university">
              Top University
            </option>

            <option value="custom">
              Custom
            </option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Package Name
          </label>

          <input
            value={
              data.package_name
            }
            onChange={(e) =>
              updateSection(
                "service_package",
                "package_name",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
            placeholder="Package name"
          />
        </div>

        <CurrencyFields
          data={data}
          update={(
            field,
            value
          ) =>
            updateSection(
              "service_package",
              field,
              value
            )
          }
        />

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Package Fee
          </label>

          <input
            type="number"
            value={
              data.package_fee
            }
            onChange={(e) =>
              updateSection(
                "service_package",
                "package_fee",
                e.target.value
              )
            }
            className="w-full h-11 px-3 rounded-xl border border-stone-200"
          />
        </div>

        <ReceivedField
          data={data}
          update={(
            field,
            value
          ) =>
            updateSection(
              "service_package",
              field,
              value
            )
          }
        />
      </div>

      <div className="mt-5">
        <AmountConversion
          label="Package Fee"
          amount={
            numberValue(
              data.package_fee
            )
          }
          currency={
            data.currency
          }
          rate={rate}
        />
      </div>

      <RevenueResult
        label="Service Package Revenue"
        amount={result.amount}
        received={
          result.received
        }
        currency={
          data.currency
        }
        rate={rate}
      />
    </SectionToggle>
  );
}

function SummaryCard({
  label,
  amount,
  variant,
}) {
  let classes =
    "border-stone-200";

  let textClasses =
    "text-stone-900";

  if (
    variant === "received"
  ) {
    classes =
      "border-emerald-200";

    textClasses =
      "text-emerald-700";
  }

  if (
    variant === "outstanding"
  ) {
    classes =
      "border-amber-200";

    textClasses =
      "text-amber-700";
  }

  return (
    <div
      className={`bg-white border ${classes} rounded-2xl p-5`}
    >
      <div className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-display font-bold ${textClasses}`}
      >
        {formatMoney(
          amount,
          "INR"
        )}
      </div>
    </div>
  );
}

function DarkTotal({
  label,
  amount,
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-white/60">
        {label}
      </div>

      <div className="text-2xl font-bold mt-1">
        {formatMoney(
          amount,
          "INR"
        )}
      </div>
    </div>
  );
}
