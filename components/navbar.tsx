"use client";
import React from "react";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";
import { Icons } from "./icons";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const Navbar = () => {
  const pathname = usePathname();
  return (
    <div className="border-b border-dotted border-border py-3 cursor-pointer ">
      <div className="flex justify-between items-center px-4 md:px-6 lg:px-8">
        <div>
          <nav className=" items-center gap-4 text-sm xl:gap-6 hidden md:flex">
            <Link
              href="https://ui.spectrumhq.in/docs/installation"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/docs/installation"
                  ? "text-foreground"
                  : "text-foreground/80"
              )}
            >
              Docs
            </Link>

            <Link
              href="https://ui.spectrumhq.in/blocks"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname?.startsWith("/blocks")
                  ? "text-foreground"
                  : "text-foreground/80"
              )}
            >
              Blocks
            </Link>

            <Link
              href="https://ui.spectrumhq.in/colors"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname?.startsWith("/colors")
                  ? "text-foreground"
                  : "text-foreground/80"
              )}
            >
              Colors
            </Link>
            {/* <Link
          href="/blog"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname?.startsWith("/colors")
              ? "text-foreground"
              : "text-foreground/80",
          )}
        >
          Blog
        </Link> */}
          </nav>
        </div>
        <div>
          <Link href="/" className="font-medium ">Json Formatter</Link>
        </div>
        <div className="flex items-center justify-end gap-4">
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="https://github.com/arihantcodes"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.gitHub className="h-5 w-4 mr-2" />
            </Link>
            <Link
              href="https://x.com/arihantCodes"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.twitter className="h-3 w-4 mr-2" />
            </Link>
          </div>

          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
