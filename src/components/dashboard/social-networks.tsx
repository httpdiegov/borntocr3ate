import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import Link from "next/link";
import { GithubIcon } from "../icons/github-icon";
import { XIcon } from "../icons/x-icon";
import { LinkedinIcon } from "../icons/linkedin-icon";

const socialLinks = [
  {
    name: "GitHub",
    href: "#",
    icon: <GithubIcon className="h-6 w-6" />,
  },
  {
    name: "X / Twitter",
    href: "#",
    icon: <XIcon className="h-6 w-6" />,
  },
  {
    name: "LinkedIn",
    href: "#",
    icon: <LinkedinIcon className="h-6 w-6" />,
  },
];

export default function SocialNetworks({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Social Networks
        </CardTitle>
        <CardDescription>
          Connect and stay updated across your networks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {socialLinks.map((link) => (
            <Button
              key={link.name}
              variant="outline"
              size="lg"
              className="flex-grow sm:flex-grow-0"
              asChild
            >
              <Link href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`Link to ${link.name}`}>
                {link.icon}
                <span className="ml-2 hidden sm:inline">{link.name}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
