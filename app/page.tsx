import { Button } from "@/components/ui/button";
import UserButton from "@/modules/auth/components/user-button";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <Button>
        Get Started
      </Button>
      <UserButton/>
    </div>
  );
}
