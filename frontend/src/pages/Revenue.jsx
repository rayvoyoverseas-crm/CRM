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
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount, currency = "INR") {
  const value = numberValue(amount);

  return `${CURRENCY_SYMBOLS[currency] || ""}${value.toLocaleString(
    "en-IN",
    {
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

            update("currency", currency);

            if (currency === "INR") {
              update("exchange_rate", 1);
            }
          }}
          className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} ({CURRENCY_SYMBOLS[c]})
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
          disabled={data.currency === "INR"}
          onChange={(e) =>
            update(
              "exchange_rate",
              e.target.value
            )
          }
          className="w-full h-11 px-3 rounded-xl border border-stone-200 disabled:bg-stone-100"
          placeholder="Example: 118.40"
        />
      </div>
    </>
  );
}

function ReceivedField({
  data,
  update,
}) {
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
    </div>
  );
}

export default function Revenue() {
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] =
    useState("");

  const [revenue, setRevenue] =
    useState(initialRevenue);

  const [loadingStudents, setLoadingStudents] =
    useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    const loadStudents = async () => {
      try {
        setLoadingStudents(true);

        const { data } = await api.get(
          "/leads",
          {
            params: {
              pipeline: "study_abroad",
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
        setLoadingStudents(false);
      }
    };

    loadStudents();
  }, [user?.role]);

  const updateSection = (
    section,
    field,
    value
  ) => {
    setRevenue((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const toggleSection = (
    section,
    enabled
  ) => {
    setRevenue((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        enabled,
      },
    }));
  };

  const calculations = useMemo(() => {
    const calculatePercentage = (
      section,
      baseField
    ) => {
      if (!section.enabled) {
        return {
          original: 0,
          inr: 0,
          receivedOriginal: 0,
          receivedInr: 0,
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

      const rate =
        section.currency === "INR"
          ? 1
          : numberValue(
              section.exchange_rate
            );

      const original =
        (base * percentage) / 100;

      const receivedOriginal =
        numberValue(
          section.received_amount
        );

      return {
        original,
        inr: original * rate,
        receivedOriginal,
        receivedInr:
          receivedOriginal * rate,
      };
    };

    const calculateProfit = (
      section
    ) => {
      if (!section.enabled) {
        return {
          original: 0,
          inr: 0,
          receivedOriginal: 0,
          receivedInr: 0,
        };
      }

      const totalTaken =
        numberValue(
          section.total_taken
        );

      const actualCost =
        numberValue(
          section.actual_cost ??
            section.amount_payable
        );

      const rate =
        section.currency === "INR"
          ? 1
          : numberValue(
              section.exchange_rate
            );

      const original = Math.max(
        0,
        totalTaken - actualCost
      );

      const receivedOriginal =
        numberValue(
          section.received_amount
        );

      return {
        original,
        inr: original * rate,
        receivedOriginal,
        receivedInr:
          receivedOriginal * rate,
      };
    };

    const university =
      calculatePercentage(
        revenue.university,
        "tuition_fee"
      );

    const educationLoan =
      calculatePercentage(
        revenue.education_loan,
        "loan_amount"
      );

    const accommodation =
      calculatePercentage(
        revenue.accommodation,
        "booking_amount"
      );

    const ielts =
      calculateProfit(
        revenue.ielts
      );

    const tuitionFeeProfit =
      calculateProfit(
        revenue.tuition_fee_profit
      );

    const visaFeeProfit =
      calculateProfit(
        revenue.visa_fee_profit
      );

    let servicePackage = {
      original: 0,
      inr: 0,
      receivedOriginal: 0,
      receivedInr: 0,
    };

    if (
      revenue.service_package.enabled
    ) {
      const rate =
        revenue.service_package
          .currency === "INR"
          ? 1
          : numberValue(
              revenue.service_package
                .exchange_rate
            );

      const original =
        numberValue(
          revenue.service_package
            .package_fee
        );

      const receivedOriginal =
        numberValue(
          revenue.service_package
            .received_amount
        );

      servicePackage = {
        original,
        inr: original * rate,
        receivedOriginal,
        receivedInr:
          receivedOriginal * rate,
      };
    }

    const entries = [
      university,
      educationLoan,
      accommodation,
      ielts,
      tuitionFeeProfit,
      visaFeeProfit,
      servicePackage,
    ];

    const expectedInr =
      entries.reduce(
        (sum, item) =>
          sum + item.inr,
        0
      );

    const receivedInr =
      entries.reduce(
        (sum, item) =>
          sum + item.receivedInr,
        0
      );

    const balanceInr =
      Math.max(
        0,
        expectedInr - receivedInr
      );

    return {
      university,
      educationLoan,
      accommodation,
      ielts,
      tuitionFeeProfit,
      visaFeeProfit,
      servicePackage,
      expectedInr,
      receivedInr,
      balanceInr,
    };
  }, [revenue]);

  if (user && user.role !== "admin") {
    return <Navigate to="/" replace />;
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

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
              Expected Revenue
            </div>

            <div className="mt-2 text-2xl font-display font-bold text-stone-900">
              {formatMoney(
                calculations.expectedInr,
                "INR"
              )}
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-emerald-600 font-semibold">
              Received
            </div>

            <div className="mt-2 text-2xl font-display font-bold text-emerald-700">
              {formatMoney(
                calculations.receivedInr,
                "INR"
              )}
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-amber-600 font-semibold">
              Outstanding
            </div>

            <div className="mt-2 text-2xl font-display font-bold text-amber-700">
              {formatMoney(
                calculations.balanceInr,
                "INR"
              )}
            </div>
          </div>
        </div>

        {/* Student */}
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
            onChange={(e) =>
              setSelectedStudent(
                e.target.value
              )
            }
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
                  key={student.id}
                  value={student.id}
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
              Revenue record for{" "}
              <strong className="text-stone-800">
                {selectedStudentData.name}
              </strong>
            </div>
          )}
        </div>

        {!selectedStudent ? (
          <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-10 text-center">
            <Calculator className="w-8 h-8 mx-auto text-stone-300 mb-3" />

            <div className="font-medium text-stone-700">
              Select a student first
            </div>

            <div className="text-sm text-stone-400 mt-1">
              Revenue options will appear after selecting a student.
            </div>
          </div>
        ) : (
          <>

            {/* University */}
            <SectionToggle
              title="University Commission"
              enabled={
                revenue.university.enabled
              }
              onChange={(enabled) =>
                toggleSection(
                  "university",
                  enabled
                )
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    University Name
                  </label>

                  <input
                    value={
                      revenue.university
                        .university_name
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
                  data={
                    revenue.university
                  }
                  update={(field, value) =>
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
                      revenue.university
                        .tuition_fee
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
                    Commission %
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    value={
                      revenue.university
                        .commission_percent
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
                  data={
                    revenue.university
                  }
                  update={(field, value) =>
                    updateSection(
                      "university",
                      field,
                      value
                    )
                  }
                />
              </div>

              <CalculationBox
                label="Calculated University Commission"
                calculation={
                  calculations.university
                }
                currency={
                  revenue.university
                    .currency
                }
              />
            </SectionToggle>

            {/* Loan */}
            <SectionToggle
              title="Education Loan"
              enabled={
                revenue.education_loan
                  .enabled
              }
              onChange={(enabled) =>
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
                update={(field, value) =>
                  updateSection(
                    "education_loan",
                    field,
                    value
                  )
                }
                organisationLabel="Loan Organisation"
                amountLabel="Loan Amount"
                amountField="loan_amount"
                calculation={
                  calculations.educationLoan
                }
              />
            </SectionToggle>

            {/* Accommodation */}
            <SectionToggle
              title="Accommodation"
              enabled={
                revenue.accommodation
                  .enabled
              }
              onChange={(enabled) =>
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
                update={(field, value) =>
                  updateSection(
                    "accommodation",
                    field,
                    value
                  )
                }
                organisationLabel="Accommodation Organisation"
                amountLabel="Accommodation / Booking Amount"
                amountField="booking_amount"
                calculation={
                  calculations.accommodation
                }
              />
            </SectionToggle>

            {/* IELTS */}
            <SectionToggle
              title="IELTS"
              enabled={
                revenue.ielts.enabled
              }
              onChange={(enabled) =>
                toggleSection(
                  "ielts",
                  enabled
                )
              }
            >
              <ProfitSection
                data={revenue.ielts}
                update={(field, value) =>
                  updateSection(
                    "ielts",
                    field,
                    value
                  )
                }
                payableLabel="Actual IELTS Cost"
                payableField="actual_cost"
                calculation={
                  calculations.ielts
                }
              />
            </SectionToggle>

            {/* Tuition */}
            <SectionToggle
              title="Tuition Fee Profit"
              enabled={
                revenue.tuition_fee_profit
                  .enabled
              }
              onChange={(enabled) =>
                toggleSection(
                  "tuition_fee_profit",
                  enabled
                )
              }
            >
              <ProfitSection
                data={
                  revenue.tuition_fee_profit
                }
                update={(field, value) =>
                  updateSection(
                    "tuition_fee_profit",
                    field,
                    value
                  )
                }
                payableLabel="Tuition Fee Need to Pay University"
                payableField="amount_payable"
                calculation={
                  calculations.tuitionFeeProfit
                }
              />
            </SectionToggle>

            {/* Visa */}
            <SectionToggle
              title="Visa Fee Profit"
              enabled={
                revenue.visa_fee_profit
                  .enabled
              }
              onChange={(enabled) =>
                toggleSection(
                  "visa_fee_profit",
                  enabled
                )
              }
            >
              <ProfitSection
                data={
                  revenue.visa_fee_profit
                }
                update={(field, value) =>
                  updateSection(
                    "visa_fee_profit",
                    field,
                    value
                  )
                }
                payableLabel="Visa Fee Need to Pay"
                payableField="amount_payable"
                calculation={
                  calculations.visaFeeProfit
                }
              />
            </SectionToggle>

            {/* Service Package */}
            <SectionToggle
              title="Rayvoy Service Package"
              enabled={
                revenue.service_package
                  .enabled
              }
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
                      revenue.service_package
                        .package_type
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
                      revenue.service_package
                        .package_name
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
                  data={
                    revenue.service_package
                  }
                  update={(field, value) =>
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
                      revenue.service_package
                        .package_fee
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
                  data={
                    revenue.service_package
                  }
                  update={(field, value) =>
                    updateSection(
                      "service_package",
                      field,
                      value
                    )
                  }
                />
              </div>

              <CalculationBox
                label="Service Package Revenue"
                calculation={
                  calculations.servicePackage
                }
                currency={
                  revenue.service_package
                    .currency
                }
              />
            </SectionToggle>

            {/* Final total */}
            <div className="bg-[#1B365D] text-white rounded-2xl p-6">
              <div className="text-sm text-white/70">
                Student Revenue Summary
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/60">
                    Expected
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatMoney(
                      calculations.expectedInr,
                      "INR"
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-white/60">
                    Received
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatMoney(
                      calculations.receivedInr,
                      "INR"
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-white/60">
                    Balance
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {formatMoney(
                      calculations.balanceInr,
                      "INR"
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="bg-[#C05B43] hover:bg-[#a94e39] rounded-xl px-6"
                onClick={() => {
                  alert(
                    "Calculator is ready. Database saving will be connected in the next step."
                  );
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Revenue
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function PercentageSection({
  data,
  update,
  organisationLabel,
  amountLabel,
  amountField,
  calculation,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {organisationLabel}
          </label>

          <input
            value={data.organisation}
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
            value={data[amountField]}
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

      <CalculationBox
        label="Calculated Commission"
        calculation={calculation}
        currency={data.currency}
      />
    </>
  );
}

function ProfitSection({
  data,
  update,
  payableLabel,
  payableField,
  calculation,
}) {
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
            value={data[payableField]}
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
            value={data.total_taken}
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

      <CalculationBox
        label="Calculated Profit"
        calculation={calculation}
        currency={data.currency}
      />
    </>
  );
}

function CalculationBox({
  label,
  calculation,
  currency,
}) {
  const balance = Math.max(
    0,
    calculation.inr -
      calculation.receivedInr
  );

  return (
    <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
        {label}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
        <div>
          <div className="text-xs text-stone-500">
            Original
          </div>

          <div className="font-semibold text-stone-900">
            {formatMoney(
              calculation.original,
              currency
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            INR Equivalent
          </div>

          <div className="font-semibold text-stone-900">
            {formatMoney(
              calculation.inr,
              "INR"
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-stone-500">
            Outstanding
          </div>

          <div className="font-semibold text-[#C05B43]">
            {formatMoney(
              balance,
              "INR"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
