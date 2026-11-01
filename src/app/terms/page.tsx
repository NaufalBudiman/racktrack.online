import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage } from "@/components/LegalPage";
import { MAX_DEVICES_PER_WORKSPACE } from "@/lib/categories";
import { MAX_MEMBERS_PER_WORKSPACE, MAX_OWNED_WORKSPACES } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Terms of Service · RackTrack",
  description: "The rules for using RackTrack.",
};

export default function TermsPage() {
  const mail = <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>;
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service">
      <p>
        These terms apply when you use RackTrack (racktrack.online), operated by <strong>{LEGAL.operator}</strong>. By
        signing in you agree to them. If you use RackTrack for a company, you confirm you may accept these terms for it.
      </p>

      <h2>The service</h2>
      <p>
        RackTrack is a free tool to track network and IT equipment, share it with your team, and keep a history of
        changes. Current limits per account: up to {MAX_DEVICES_PER_WORKSPACE} devices per workspace,{" "}
        {MAX_OWNED_WORKSPACES} workspaces you own, and {MAX_MEMBERS_PER_WORKSPACE} members (including pending invites) per
        workspace. We may change features or limits, and will give notice in the app before reducing limits on data you
        already have.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with a Google account and are responsible for what happens under it.</li>
        <li>
          Workspace owners and admins decide who gets access. Invite links are tied to one email address; don't forward
          them to anyone else.
        </li>
      </ul>

      <h2>Your data</h2>
      <p>
        You keep ownership of everything you put into RackTrack. You give us permission to store and display it only so we
        can run the service for you and your workspace members. How we handle it is described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p>
        RackTrack is not a backup. Keep your own copies of anything critical (for example, the spreadsheets you import).
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't use RackTrack for anything illegal, or to store data you have no right to keep.</li>
        <li>Don't try to access workspaces or accounts that aren't yours, or to break, overload or scrape the service.</li>
        <li>Don't use it to send spam, including through invitations.</li>
      </ul>
      <p>We may suspend accounts that break these rules, and will tell you why when we can.</p>

      <h2>No warranty</h2>
      <p>
        RackTrack is provided free and “as is”, without warranties of any kind. We do our best to keep it available and
        your data safe, but we can't promise it will always be available, error-free, or that data will never be lost.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, {LEGAL.operator} is not liable for indirect or consequential losses, lost profits, or
        lost data arising from your use of RackTrack, and any remaining liability is limited as far as the law permits.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using RackTrack at any time and ask us to delete your data ({mail}). If we ever shut the service down,
        we'll give at least 30 days' notice so you can copy your data out.
      </p>

      <h2>Changes and law</h2>
      <p>
        We may update these terms and will change the date at the top when we do; continuing to use RackTrack means you
        accept the new version. These terms are governed by the laws of the Republic of Indonesia.
      </p>

      <h2>Contact</h2>
      <p>{mail}</p>
    </LegalPage>
  );
}
