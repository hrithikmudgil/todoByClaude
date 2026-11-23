using DbUp;

namespace TodoApi.Data;

/// <summary>Applies the embedded <c>Data/Migrations/*.sql</c> scripts once each, in name order, using DbUp.</summary>
public static class DbMigrator
{
    public static void Migrate(string connectionString)
    {
        var upgrader = DeployChanges.To
            .PostgresqlDatabase(connectionString)
            .WithScriptsEmbeddedInAssembly(
                typeof(DbMigrator).Assembly,
                name => name.Contains(".Data.Migrations.", StringComparison.Ordinal)
                        && name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            .WithTransactionPerScript()
            .LogToConsole()
            .Build();

        var result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            throw new InvalidOperationException("Database migration failed.", result.Error);
        }
    }
}
