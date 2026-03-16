export const tailorMeasurementsPage = {
  title: "Tailor Measurements",
  description:
    "A clean measurement record prepared for tailoring conversations, fittings, and quick reference across devices.",
  pdfPath: "/downloads/tailor-measurements.pdf",
  contact: {
    name: "Abodid Sahoo",
    email: "abodidsahoo@gmail.com",
    phone: "+91 9439094370",
  },
  profiles: [
    {
      name: "Yashaswinee Sahoo",
      height: `5'6"`,
      bodyType: "Pear-shaped",
      note: "Master record containing confirmed measurements and clearly marked estimates.",
      measurements: [
        { label: "Chest / Bust", value: "38 in", estimated: false },
        { label: "Waist", value: "32 in", estimated: false },
        { label: "Sleeve Length", value: "24 in", estimated: false },
        { label: "Wrist / Sleeve Mahuri", value: "7.5 in", estimated: false },
        { label: "High Hip", value: "38 in", estimated: false },
        { label: "Full Hip / Seat", value: "45 in", estimated: false },
        { label: "Pant Length (outseam)", value: "40 in", estimated: false },
        { label: "Shoulder", value: "16 in", estimated: true },
        { label: "Neck", value: "15.5 in", estimated: true },
        { label: "Armhole", value: "18 in", estimated: true },
      ],
    },
    {
      name: "Abodid Sahoo",
      height: `5'10"`,
      bodyType: "Average to slightly athletic, broad shoulders",
      note: "Use these as the current tailoring baseline for shirts and trousers.",
      measurements: [
        { label: "Chest", value: "42 in", estimated: false },
        { label: "Shoulder", value: "20 in", estimated: false },
        { label: "Shirt Length", value: "28 in", estimated: false },
        { label: "Sleeve Length", value: "24 in", estimated: false },
        { label: "Collar / Neck", value: "16 in", estimated: false },
        { label: "Waist", value: "37.5 in", estimated: false },
        { label: "Seat / Hip", value: "44 in", estimated: false },
        { label: "Pant Length (outseam)", value: "40 in", estimated: false },
        { label: "Full Crotch Length", value: "26 in", estimated: false },
        { label: "Thigh", value: "27 in", estimated: false },
        { label: "Pant Mahuri / Bottom Opening", value: "14 in", estimated: false },
        { label: "Armhole", value: "20 in", estimated: true },
      ],
    },
  ],
  notes:
    "Mahuri / Mohri refers to the opening at the end of sleeves or pants. Pant length is listed as outseam. Only provided values or explicitly estimated values are included here.",
};
