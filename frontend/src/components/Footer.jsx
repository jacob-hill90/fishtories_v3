import { TEAM_MEMBERS } from "../data/team.js";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-about">
          <div className="footer-heading">
            <span aria-hidden="true">🐟</span> FishTories
          </div>
          <p>
            FishTories began as a collaborative project designed by members of
            Code Platoon’s Romeo Cohort. We created the original site to
            showcase our collective problem-solving and design skills. Our team
            members are U.S. military veterans or veteran spouses. If you have
            questions about the project or want to collaborate, feel free to
            connect with us on LinkedIn.
          </p>
          <strong className="veteran-note">
            Proudly built by veterans and veteran spouses.
          </strong>
        </div>

        <div className="footer-team">
          <h2>Build Team</h2>
          <div className="team-links">
            {TEAM_MEMBERS.map((member) => (
              <div className="team-member" key={member.name}>
                <span>{member.name}</span>
                <div className="social-links">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} on GitHub`}
                  >
                    GitHub ↗
                  </a>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} on LinkedIn`}
                  >
                    LinkedIn ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} FishTories
      </div>
    </footer>
  );
}
