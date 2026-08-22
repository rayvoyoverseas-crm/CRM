import React from "react";
import Layout from "@/components/Layout";

export default function Calculation() {
  return (
    <Layout
      title="Calculation"
      subtitle="Student financial requirement calculator"
    >
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-900">
          Student Financial Calculator
        </h2>

        <p className="text-sm text-stone-500 mt-2">
          Calculate tuition fees, living expenses, scholarships,
          education loans and student funding requirements.
        </p>
      </div>
    </Layout>
  );
}
