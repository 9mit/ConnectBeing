import { Cormorant_Garamond } from "next/font/google";

import { LandingExperience } from "@/components/landing/LandingExperience";

const landingDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-landing-display",
  display: "swap",
});

export const metadata = {
  title: "MadLove — Some people become your universe",
  description:
    "A cinematic, privacy-first space for two. Enter the universe. Build your story.",
};

export default function HomePage() {
  return (
    <div className={landingDisplay.variable}>
      <LandingExperience />
    </div>
  );
}
