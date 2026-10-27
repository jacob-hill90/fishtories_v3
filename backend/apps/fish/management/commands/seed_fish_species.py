from django.core.management.base import BaseCommand

from apps.fish.models import FishSpecies


# Small North American starter catalog, not a complete taxonomy or field guide.
# Common/scientific names are easy to expand later through Django admin.
STARTER_SPECIES = (
    ("Black crappie", "Pomoxis nigromaculatus"),
    ("Bluegill", "Lepomis macrochirus"),
    ("Bowfin", "Amia calva"),
    ("Brook trout", "Salvelinus fontinalis"),
    ("Brown trout", "Salmo trutta"),
    ("Channel catfish", "Ictalurus punctatus"),
    ("Chinook salmon", "Oncorhynchus tshawytscha"),
    ("Coho salmon", "Oncorhynchus kisutch"),
    ("Common carp", "Cyprinus carpio"),
    ("Flathead catfish", "Pylodictis olivaris"),
    ("Freshwater drum", "Aplodinotus grunniens"),
    ("Largemouth bass", "Micropterus salmoides"),
    ("Lake sturgeon", "Acipenser fulvescens"),
    ("Lake trout", "Salvelinus namaycush"),
    ("Longnose gar", "Lepisosteus osseus"),
    ("Muskellunge", "Esox masquinongy"),
    ("Northern pike", "Esox lucius"),
    ("Pumpkinseed", "Lepomis gibbosus"),
    ("Rainbow trout", "Oncorhynchus mykiss"),
    ("Rock bass", "Ambloplites rupestris"),
    ("Smallmouth bass", "Micropterus dolomieu"),
    ("Walleye", "Sander vitreus"),
    ("White bass", "Morone chrysops"),
    ("White crappie", "Pomoxis annularis"),
    ("Yellow perch", "Perca flavescens"),
)


class Command(BaseCommand):
    help = "Add a starter list of common fish species (safe to rerun)."

    def handle(self, *args, **options):
        added = 0
        for common_name, scientific_name in STARTER_SPECIES:
            _, created = FishSpecies.objects.get_or_create(
                common_name=common_name,
                defaults={"scientific_name": scientific_name},
            )
            added += int(created)
        self.stdout.write(self.style.SUCCESS(
            f"Fish species ready. Added {added}; total {FishSpecies.objects.count()}."
        ))
