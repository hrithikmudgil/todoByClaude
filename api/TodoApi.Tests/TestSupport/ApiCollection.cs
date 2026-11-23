namespace TodoApi.Tests.TestSupport;

/// <summary>One API host and one database shared by every test class (they run serially within the collection).</summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
