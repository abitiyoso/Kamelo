import Image from "next/image";
export function Mascot({
  pose = "welcome",
  size = 96,
}: {
  pose?: "welcome" | "onboarding" | "success" | "empty" | "help";
  size?: number;
}) {
  return (
    <Image
      className="leo-stay"
      src={`/images/mascot/leo-stay-${pose}.png`}
      alt="LEO Stay, pendamping ELENIO"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
    />
  );
}
