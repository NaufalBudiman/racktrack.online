import type { Metadata } from "next";
import { LEGAL, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · RackTrack",
  description: "What RackTrack collects, why, who can see it, and how to delete it.",
};

export default function PrivacyPage() {
  const mail = <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>;
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy">
      <p>
        RackTrack (racktrack.online) is a free inventory manager for network and IT equipment, operated by{" "}
        <strong>{LEGAL.operator}</strong>. This page explains what we collect, why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your Google account basics:</strong> name, email address and profile picture, received when you sign in
          with Google. We request only the <code>openid</code>, <code>email</code> and <code>profile</code> scopes. We never
          see your Google password and get no access to Gmail, Drive, Calendar or other Google data.
        </li>
        <li>
          <strong>What you put in:</strong> devices and their details (name, serial, type, status, location, customer,
          contact, dates, notes), workspace names, and the history of changes, including who made them.
        </li>
        <li>
          <strong>Invitations:</strong> the email address and role of people you invite to a workspace.
        </li>
        <li>
          <strong>Technical essentials:</strong> a sign-in session cookie, a cookie that remembers your active workspace, and
          a small amount of browser storage for display preferences. Our hosting provider keeps standard server logs (such
          as IP address and time of request) for security and troubleshooting.
        </li>
      </ul>
      <p>We do not use advertising, analytics or tracking cookies, and we don't build profiles of you.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and show you the workspaces you belong to.</li>
        <li>To store and display your inventory, and the change history your team relies on.</li>
        <li>To let workspace owners and admins invite and manage members.</li>
        <li>To keep the service secure and working.</li>
      </ul>
      <p>
        RackTrack's use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Who can see your data</h2>
      <ul>
        <li>
          <strong>Workspace members.</strong> Everything in a workspace is visible to its members, and your name, email and
          picture are shown to the people you share a workspace with. Nobody else can see a workspace.
        </li>
        <li>
          <strong>Service providers</strong> that run RackTrack for us: Vercel (hosting), Neon (database) and Google
          (sign-in). They process data only to provide their service.
        </li>
        <li>Authorities, only if the law requires it.</li>
      </ul>
      <p>We never sell or rent your data.</p>

      <h2>Your customers' details</h2>
      <p>
        If you record customer names or contact details, you decide what to enter and are responsible for having a valid
        reason to keep it. Please don't store more personal data about others than your work needs.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        Your data is kept while your account and workspaces exist. You can edit or delete devices at any time, and leave
        workspaces you don't own. To delete your account, or a workspace you own with everything in it, email {mail}. We
        will do it within 30 days, after which it is removed from the live database; backups held by our database provider
        expire on their normal schedule.
      </p>

      <h2>Security</h2>
      <p>
        Connections use HTTPS, sign-in is handled by Google, and every database query is limited to workspaces you belong
        to. No system is perfectly secure, so please only invite people you trust.
      </p>

      <h2>Children</h2>
      <p>RackTrack is a work tool and is not meant for children under 13.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy we'll update the date at the top. For significant changes, we'll make it visible in the
        app.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests: {mail}.</p>
    </LegalPage>
  );
}
