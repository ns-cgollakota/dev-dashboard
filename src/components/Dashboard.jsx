import { SECTIONS } from '../config/sections';

function getSectionProps(id, config) {
  switch (id) {
    case 'jira':
      return { jiraBaseUrl: config.jiraBaseUrl, sectionId: id };
    case 'github-prs':
      return { sectionId: id };
    case 'confluence':
      return { confluenceBaseUrl: config.confluenceBaseUrl, sectionId: id };
    default:
      return { sectionId: id };
  }
}

export function Dashboard({ config }) {
  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.filter((s) => s.enabled).map((section) => {
        const Component = section.component;
        return <Component key={section.id} {...getSectionProps(section.id, config)} />;
      })}
    </div>
  );
}
